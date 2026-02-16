# courses/sharepoint.py
import re
import requests
from dataclasses import dataclass
from urllib.parse import quote

from django.conf import settings

from users.graph import get_graph_app_token


def _graph_headers() -> dict:
    return {"Authorization": f"Bearer {get_graph_app_token()}"}


def _graph_url(path: str) -> str:
    return f"https://graph.microsoft.com/v1.0{path}"


def _slug_folder_name(name: str) -> str:
    """
    Make a SharePoint-safe folder name from a course title.
    Keeps it readable; strips dangerous characters; trims.
    """
    s = (name or "").strip()
    if not s:
        return "Untitled Course"

    # SharePoint disallows: " * : < > ? / \ |
    s = re.sub(r'[\"\*\:\<\>\?\/\\\|]+', " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    # avoid trailing dots/spaces
    s = s.rstrip(". ").strip()

    # cap length to something safe-ish (SharePoint path limits exist)
    if len(s) > 150:
        s = s[:150].rstrip()

    return s or "Untitled Course"


@dataclass
class SharePointFileRef:
    drive_id: str
    item_id: str
    web_url: str
    name: str
    mime: str
    size: int


class SharePointStorage:
    """
    Helper for uploading into a single storage SharePoint site.
    Uses Graph app-only permissions (client_credentials).
    """

    def __init__(self):
        self.host = settings.SHAREPOINT_TENANT_HOST
        self.site_path = settings.SHAREPOINT_STORAGE_SITE_PATH
        self.drive_name = settings.SHAREPOINT_STORAGE_DRIVE_NAME

        self.office_root = settings.SHAREPOINT_OFFICE_ROOT_FOLDER
        self.field_root = settings.SHAREPOINT_FIELD_ROOT_FOLDER

        self._site_id = None
        self._drive_id = None

    def site_id(self) -> str:
        if self._site_id:
            return self._site_id

        # /sites/{hostname}:/sites/{sitePath}
        path = f"/sites/{self.host}:/sites/{quote(self.site_path, safe='')}"
        r = requests.get(_graph_url(path), headers=_graph_headers(), timeout=20)
        if r.status_code >= 400:
            raise RuntimeError(f"Graph site lookup failed: {r.status_code} {r.text}")

        self._site_id = (r.json() or {}).get("id") or ""
        if not self._site_id:
            raise RuntimeError("Graph site lookup returned no id")
        return self._site_id

    def drive_id(self) -> str:
        if self._drive_id:
            return self._drive_id

        sid = self.site_id()
        r = requests.get(_graph_url(f"/sites/{sid}/drives"), headers=_graph_headers(), timeout=20)
        if r.status_code >= 400:
            raise RuntimeError(f"Graph drives lookup failed: {r.status_code} {r.text}")

        drives = (r.json() or {}).get("value") or []
        wanted = (self.drive_name or "").strip().lower()

        found = None
        for d in drives:
            if (d.get("name") or "").strip().lower() == wanted:
                found = d
                break

        if not found and drives:
            found = drives[0]

        if not found or not found.get("id"):
            raise RuntimeError("Could not resolve SharePoint drive id")

        self._drive_id = found["id"]
        return self._drive_id

    def root_folder_for_track(self, course_track: str) -> str:
        # course_track is "office" or "field"
        if (course_track or "").strip().lower() == "office":
            return self.office_root
        return self.field_root

    def ensure_course_storage_folder_name(self, course) -> str:
        """
        Ensure Course.storage_folder_name is set once and stable.
        Does not rename/move if title changes.
        """
        current = (getattr(course, "storage_folder_name", "") or "").strip()
        if current:
            return current

        safe = _slug_folder_name(getattr(course, "title", "") or "")
        course.storage_folder_name = safe
        course.save(update_fields=["storage_folder_name", "updated_at"])
        return safe

    def ensure_folder(self, folder_path: str) -> None:
        """
        Ensure folder path exists (relative to drive root).
        Creates segments if missing.
        """
        drive_id = self.drive_id()
        parts = [p for p in (folder_path or "").split("/") if p]
        if not parts:
            return

        running = ""
        for part in parts:
            parent_path = running
            running = f"{running}/{part}" if running else part

            # Check existence
            check = requests.get(
                _graph_url(f"/drives/{drive_id}/root:/{quote(running, safe='/')}"),
                headers=_graph_headers(),
                timeout=20,
            )
            if check.status_code == 200:
                continue

            # Create under parent
            parent = parent_path if parent_path else ""
            create_path = f"/drives/{drive_id}/root"
            if parent:
                create_path += f":/{quote(parent, safe='/')}:"
            create_path += "/children"

            body = {
                "name": part,
                "folder": {},
                "@microsoft.graph.conflictBehavior": "fail",
            }

            cr = requests.post(
                _graph_url(create_path),
                headers={**_graph_headers(), "Content-Type": "application/json"},
                json=body,
                timeout=30,
            )
            if cr.status_code == 409:
                # someone else created it concurrently; ok
                continue
            if cr.status_code >= 400:
                raise RuntimeError(
                    f"Graph folder create failed for '{running}': {cr.status_code} {cr.text}"
                )

    def create_upload_session(self, file_path: str) -> str:
        """
        Create an upload session for /drive/root:/path/to/file.ext
        Returns uploadUrl.
        """
        drive_id = self.drive_id()
        url = _graph_url(
            f"/drives/{drive_id}/root:/{quote(file_path, safe='/')}:/createUploadSession"
        )
        body = {"item": {"@microsoft.graph.conflictBehavior": "replace"}}

        r = requests.post(
            url,
            headers={**_graph_headers(), "Content-Type": "application/json"},
            json=body,
            timeout=30,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Graph createUploadSession failed: {r.status_code} {r.text}")

        upload_url = (r.json() or {}).get("uploadUrl") or ""
        if not upload_url:
            raise RuntimeError("Graph createUploadSession returned no uploadUrl")
        return upload_url

    def upload_file_via_session(self, upload_url: str, django_file, chunk_size: int) -> dict:
        """
        Upload file bytes to Graph uploadUrl in chunks.
        Returns final driveItem JSON.
        """
        total = int(getattr(django_file, "size", 0) or 0)
        if total <= 0:
            raise RuntimeError("Empty upload")

        start = 0
        for chunk in django_file.chunks(chunk_size=chunk_size):
            end = start + len(chunk) - 1
            headers = {
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {start}-{end}/{total}",
            }

            r = requests.put(upload_url, headers=headers, data=chunk, timeout=120)
            if r.status_code in (200, 201):
                return r.json()
            if r.status_code == 202:
                start = end + 1
                continue

            raise RuntimeError(f"Graph upload chunk failed: {r.status_code} {r.text}")

        raise RuntimeError("Upload session did not complete")

    def _extract_file_ref(self, item: dict, *, drive_id: str, fallback_name: str) -> SharePointFileRef:
        item_id = item.get("id") or ""
        web_url = item.get("webUrl") or ""
        name = item.get("name") or fallback_name
        size = int(item.get("size") or 0)

        mime = ""
        file_obj = item.get("file") or {}
        if isinstance(file_obj, dict):
            mime = file_obj.get("mimeType") or ""

        if not item_id:
            raise RuntimeError("Upload succeeded but item id missing")

        return SharePointFileRef(
            drive_id=drive_id,
            item_id=item_id,
            web_url=web_url,
            name=name,
            mime=mime,
            size=size,
        )

    # -----------------------------
    # ✅ Videos (existing)
    # -----------------------------
    def upload_course_section_video(self, *, course, section, filename: str, django_file) -> SharePointFileRef:
        """
        Upload to:
          <root>/<CourseFolder>/Sections/<section.order>/Videos/<filename>
        """
        drive_id = self.drive_id()
        root = self.root_folder_for_track(getattr(course, "track", ""))
        course_folder = self.ensure_course_storage_folder_name(course)

        folder_path = f"{root}/{course_folder}/Sections/{int(section.order)}/Videos"
        self.ensure_folder(folder_path)

        file_path = f"{folder_path}/{filename}"
        upload_url = self.create_upload_session(file_path)

        chunk_size = int(getattr(settings, "GRAPH_UPLOAD_CHUNK_SIZE", 10 * 1024 * 1024))
        item = self.upload_file_via_session(upload_url, django_file, chunk_size=chunk_size)

        return self._extract_file_ref(item, drive_id=drive_id, fallback_name=filename)

    # -----------------------------
    # ✅ NEW: Course thumbnail upload
    # -----------------------------
    def upload_course_thumbnail(self, *, course, filename: str, django_file) -> SharePointFileRef:
        """
        Upload to:
          <root>/<CourseFolder>/Thumbnail/<filename>

        This is meant for course thumbnail images (png/jpg/webp).
        """
        drive_id = self.drive_id()
        root = self.root_folder_for_track(getattr(course, "track", ""))
        course_folder = self.ensure_course_storage_folder_name(course)

        folder_path = f"{root}/{course_folder}/Thumbnail"
        self.ensure_folder(folder_path)

        file_path = f"{folder_path}/{filename}"
        upload_url = self.create_upload_session(file_path)

        chunk_size = int(getattr(settings, "GRAPH_UPLOAD_CHUNK_SIZE", 10 * 1024 * 1024))
        item = self.upload_file_via_session(upload_url, django_file, chunk_size=chunk_size)

        return self._extract_file_ref(item, drive_id=drive_id, fallback_name=filename)

    def download_stream(self, drive_id: str, item_id: str, range_header: str | None = None) -> requests.Response:
        """
        GET /drives/{driveId}/items/{itemId}/content with optional Range.
        Returns a streaming requests.Response
        """
        url = _graph_url(f"/drives/{drive_id}/items/{item_id}/content")
        headers = _graph_headers()
        if range_header:
            headers["Range"] = range_header

        r = requests.get(url, headers=headers, stream=True, timeout=60)
        return r

    # -----------------------------
    # ✅ NEW: Embed helpers (for LMS playback)
    # -----------------------------
    def _site_web_base(self) -> str:
        """
        https://<tenant-host>/sites/<site_path>
        """
        sp = (self.site_path or "").strip().strip("/")
        # if someone configured "sites/Foo" already, normalize to "Foo"
        if sp.lower().startswith("sites/"):
            sp = sp.split("/", 1)[1]
        return f"https://{self.host}/sites/{sp}"

    def _get_drive_item_meta(self, drive_id: str, item_id: str) -> dict:
        """
        Fetch SharePoint ids (listItemUniqueId) for embed.aspx UniqueId.
        """
        url = _graph_url(
            f"/drives/{quote(drive_id, safe='')}/items/{quote(item_id, safe='')}"
            "?$select=id,name,webUrl,sharepointIds"
        )
        r = requests.get(url, headers=_graph_headers(), timeout=20)
        if r.status_code >= 400:
            raise RuntimeError(f"Graph driveItem lookup failed: {r.status_code} {r.text}")
        return r.json() or {}

    def build_embed_src_for_drive_item(self, drive_id: str, item_id: str) -> str:
        """
        Build the SharePoint embed.aspx SRC url (Option A style) so the LMS can iframe it.

        Returns:
          https://<tenant>/sites/<site>/_layouts/15/embed.aspx?UniqueId=<GUID>&embed=...&referrer=...&referrerScenario=...
        """
        meta = self._get_drive_item_meta(drive_id, item_id)

        sp_ids = meta.get("sharepointIds") or {}
        unique_id = (sp_ids.get("listItemUniqueId") or "").strip()

        # Fallback: if Graph didn't return listItemUniqueId for some reason, try to extract from any url text
        if not unique_id:
            web_url = (meta.get("webUrl") or "").strip()
            m = re.search(r"uniqueid=([0-9a-fA-F-]{36})", web_url, flags=re.IGNORECASE)
            if m:
                unique_id = m.group(1)

        if not unique_id:
            return ""

        base = self._site_web_base()
        # This matches your “Option A” style (just the src, not the full <iframe> tag)
        return (
            f"{base}/_layouts/15/embed.aspx"
            f"?UniqueId={quote(unique_id, safe='')}"
            f"&embed=%7B%22ust%22%3Atrue%2C%22hv%22%3A%22CopyEmbedCode%22%7D"
            f"&referrer=StreamWebApp"
            f"&referrerScenario=EmbedDialog.Create"
        )

    # -----------------------------
    # ✅ NEW: Delete helpers
    # -----------------------------
    def delete_item_by_path(self, path_in_drive: str) -> None:
        """
        Delete a file/folder by path in the drive.
        Example: "office/My Course Folder"
        """
        drive_id = self.drive_id()
        url = _graph_url(f"/drives/{drive_id}/root:/{quote(path_in_drive, safe='/')}")
        r = requests.delete(url, headers=_graph_headers(), timeout=30)

        # 204 deleted, 404 already gone -> OK
        if r.status_code in (204, 404):
            return
        if r.status_code >= 400:
            raise RuntimeError(f"Graph delete failed for '{path_in_drive}': {r.status_code} {r.text}")

    def delete_course_folder(self, course) -> None:
        """
        Delete the entire course folder:
          <root>/<CourseFolder>
        """
        root = self.root_folder_for_track(getattr(course, "track", ""))
        folder = (getattr(course, "storage_folder_name", "") or "").strip()

        if not folder:
            folder = self.ensure_course_storage_folder_name(course)

        self.delete_item_by_path(f"{root}/{folder}")
