# Corporate LMS

This project is a **Learning Management System (LMS)** built for internal use at the company. It has a **React frontend** and a **Django backend**, and is currently running locally. The system integrates with **Microsoft authentication** and **SharePoint** for video content.

---

## Features

### Authentication & Roles
- Login via **Microsoft authentication**.
- Two roles: **Field Engineers** (Microsoft F3 license) and **Office Staff** (Microsoft E3 license).
- Roles are automatically verified via Microsoft license assignments.
- Specific **upload privileges** are restricted to members of a designated Microsoft group.

### Content Management
- Content (videos, documents) is **embedded from SharePoint** using embed codes.
- **Uploads page** allows authorized office staff to upload and manage content.
- Uploaded content is stored in a **structured folder pattern in SharePoint** and reflected in the Django backend.
- Role-based access ensures content visibility and modification rights.

### Frontend (React)
- Fully responsive interface.
- **Search bar** for courses.
- Working **footer**.
- Course pages and **video player** integration.
- Uploads page for authorized users.

### Backend (Django)
- REST APIs for courses, content management, and user roles.
- JWT and Azure authentication used for different purposes, working seamlessly together.
- Permissions and API access customized for both frontend and backend requirements.

### Security & Integration
- **Azure keys** used for secure access where required.
- Role verification integrated with Microsoft licenses and group memberships.
- JWT tokens and Azure authentication ensure secure API and frontend interactions.

### Deployment
- Currently running locally.
- Planned deployment on **Google Cloud Platform (GCP)**.

---

## Technologies Used

- **Frontend:** React, Vite, JavaScript, CSS
- **Backend:** Django, Django REST Framework
- **Authentication:** Microsoft Authentication, JWT
- **Storage:** SharePoint for video content
- **Cloud:** Google Cloud Platform (future deployment)
- **Database:** SQLite (local), can be extended for production

---

## Project Structure

