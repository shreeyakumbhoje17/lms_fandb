import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

export default function CoursePlayer() {
  const { courseId } = useParams();

  const course = useMemo(() => {
    // ✅ 1) Introduction to Aspect
    if (courseId === "introduction-to-aspect") {
      return {
        title: "Introduction to Aspect",
        sections: [
          {
            title: "Section 1: Introduction",
            lectures: [
              {
                id: "welcome",
                title: "Welcome",
                duration: "4min",
              },
              { id: "overview", title: "Company Overview", duration: "6min" },
            ],
          },
        ],
      };
    }

    // ✅ 2) Company Essentials
    if (courseId === "company-overview") {
      const companyEssentialTitles = [
        "Work Type Navigation",
        "Get Candidates",
        "Scheduling",
        "Job Despatch & In Transit",
        "Fixed-Price Work Orders & Estimations Tools",
        "Trade Inspection Forms",
        "Account Status",
        "Customer Portal",
        "Debt Chasing",
        "Discount Entitlement",
        "Online Web chat",
        "Pending Lead Customers Follow ups",
        "Referral Program",
        "CRM Marketing",
        "NPS",
        "Digital Telecoms Package: RTC & TASK",
        "ROAS",
        "Data",
      ];

      return {
        title: "Company Essentials",
        sections: companyEssentialTitles.map((t, idx) => ({
          id: `ce-${idx + 1}`,
          title: t,
          lectures: [],
        })),
      };
    }

    // ✅ 3) Chumley Overview
    if (courseId === "chumley-overview") {
      return {
        title: "Chumley Overview",
        sections: [
          {
            title: "Chumley Object Structure",
            lectures: [
              { id: "what", title: "What is Chumley?", duration: "4min" },
              { id: "why", title: "Why it matters", duration: "5min" },
            ],
          },
        ],
      };
    }

    // ✅ 4) Asset Management (with sub-sections)
    if (courseId === "asset-management") {
      return {
        title: "Asset Management",
        sections: [
          {
            title: "Asset Management",
            lectures: [
              {
                id: "asset-management-get-candidates",
                title: "Asset Management - Get Candidates",
                duration: "—",
              },
              {
                id: "asset-management-swaps",
                title: "Asset Management & Swaps",
                duration: "—",
              },
              {
                id: "vehicle-cost",
                title: "Vehicle & Cost",
                duration: "—",
              },
            ],
          },
        ],
      };
    }

    // ✅ 5) FSL App - FAQs Directory
    if (courseId === "fsl-walkthrough") {
      return {
        title: "FSL App - FAQs Directory",
        sections: [
          {
            title: "1. Setting up and Logging In & Out of FSL APP",
            lectures: [
              { id: "fsl-login-logout", title: "How to Log out and Log in of the FSL App", duration: "—" },
              { id: "fsl-reset-password", title: "How to reset your password on the FSL if you forgot", duration: "—" },
              { id: "fsl-setup", title: "How to set up your FSL App", duration: "—" },
              { id: "fsl-new-phone-setup", title: "How To Set the App up on a New Phone", duration: "—" },
            ],
          },
          {
            title: "2. How to use the FSL App",
            lectures: [
              { id: "fsl-reactive-job", title: "How to Complete a Reactive Job", duration: "—" },
              { id: "fsl-on-site-agreement", title: "How to Create an On-site Agreement", duration: "—" },
              { id: "fsl-purchase-order", title: "How to Create a Purchase Order", duration: "—" },
              { id: "fsl-book-fixed-price-job", title: "How to Book a Fixed Price Job", duration: "—" },
              { id: "fsl-complete-fixed-price-job", title: "How to Complete a Fixed Price Job", duration: "—" },
              { id: "fsl-gas-safety-assessment", title: "How to Complete a Gas Safety Assessment", duration: "—" },
              { id: "fsl-book-follow-up-jobs", title: "How to Book Follow-Up Jobs: Demo Video: ?", duration: "—" },
              { id: "fsl-use-app-demo", title: "How To Use the FSL App: Demo Video ?", duration: "—" },
            ],
          },
          {
            title: "3) Likely challenges faced on job",
            lectures: [
              { id: "fsl-office-support", title: "Requesting Office support", duration: "—" },
              { id: "fsl-refresh-app", title: "How To Refresh the Field Service App", duration: "—" },
              { id: "fsl-data-sync", title: "How to Data Sync the Field Service App", duration: "—" },
              { id: "fsl-failed-payments", title: "Failed Payments on the Field Service App", duration: "—" },
              { id: "fsl-search-jobs", title: "How to search for jobs on the Field Service App", duration: "—" },
            ],
          },
        ],
      };
    }

    // ✅ 6) Security Essentials
    if (courseId === "security-essentials") {
      return {
        title: "Security Essentials",
        sections: [
          {
            title: "Section 1: Basics",
            lectures: [
              { id: "policy", title: "Security Policy", duration: "5min" },
              { id: "passwords", title: "Password Hygiene", duration: "4min" },
            ],
          },
        ],
      };
    }

    // ✅ 7) Field Engineer's Essentials (your items)
    if (courseId === "field-engineers-essentials") {
      return {
        title: "Field Engineer's Essentials",
        sections: [
          {
            title: "Field Engineer's Essentials",
            lectures: [
              { id: "engineer-portal", title: "Engineer Portal", duration: "—" },
              { id: "engineer-application-process", title: "Engineer Application Process", duration: "—" },
              { id: "engineer-performance-metrics", title: "Engineer Performance Metrics", duration: "—" },
              { id: "engineer-performance-tier-pay", title: "Engineer Performance tier of pay", duration: "—" },
              { id: "engineer-pay", title: "Engineer pay", duration: "—" },
              { id: "engineer-onsite-workflow", title: "Engineer Onsite Workflow & Communication", duration: "—" },
              { id: "purchase-order", title: "Purchase Order", duration: "—" },
            ],
          },
        ],
      };
    }

    // ✅ 8) Customer Portal
    if (courseId === "customer-portal") {
      return {
        title: "Customer Portal",
        sections: [
          {
            lectures: [
              { id: "cp-intro", title: "Introduction to Customer Portal", duration: "—" },
              { id: "cp-login", title: "Customer Workflow & Account Types", duration: "—" },
              { id: "cp-navigation", title: "Online Booking", duration: "—" },
              { id: "cp-common-actions", title: "Customer Card Security", duration: "—" },
            ],
          },
        ],
      };
    }

    return { title: "Course not found", sections: [] };
  }, [courseId]);

  // ✅ helper: find first lecture in course (if exists)
  const findFirstLecture = (c) => {
    for (const sec of c.sections || []) {
      if (sec.lectures && sec.lectures.length > 0) return sec.lectures[0];
    }
    return null;
  };

  const [activeLecture, setActiveLecture] = useState(findFirstLecture(course));
  const [activeTitleOnly, setActiveTitleOnly] = useState(null);
  const [tab, setTab] = useState("overview");

  // ✅ Reset when route changes
  useEffect(() => {
    setActiveLecture(findFirstLecture(course));
    setActiveTitleOnly(null);
    setTab("overview");
  }, [courseId, course]);

  return (
    <div style={{ display: "flex", gap: 16, padding: 16 }}>
      {/* LEFT */}
      <div style={{ flex: 1 }}>
        <h2 style={{ marginBottom: 8 }}>{course.title}</h2>

        {/* ✅ If we selected a section title (Company Essentials titles) */}
        {activeTitleOnly ? (
          <>
            <div
              style={{
                width: "100%",
                height: 320,
                borderRadius: 12,
                border: "1px solid #eee",
                background: "#fafafa",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{activeTitleOnly}</div>
                <div style={{ marginTop: 8, opacity: 0.7 }}>
                  Sub-items will be added later under this title.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => setTab("overview")}>Overview</button>
              <button onClick={() => setTab("notes")}>Notes</button>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 12,
                minHeight: 120,
              }}
            >
              {tab === "overview" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div>
                    <h4 style={{ marginTop: 0, marginBottom: 8 }}>Section Overview</h4>
                    <p style={{ lineHeight: 1.6, margin: 0 }}>
                      This section covers essential company processes and tools. Detailed lectures will be added soon to help you master each aspect of your role. This content is designed to provide you with comprehensive knowledge about our operational framework.
                    </p>
                  </div>
                  
                  <div>
                    <h4 style={{ marginTop: 0, marginBottom: 8 }}>Coming Soon</h4>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      <li style={{ marginBottom: 6 }}>Detailed video lectures</li>
                      <li style={{ marginBottom: 6 }}>Practical exercises</li>
                      <li style={{ marginBottom: 6 }}>Assessment quizzes</li>
                      <li style={{ marginBottom: 6 }}>Downloadable resources</li>
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ marginTop: 0, marginBottom: 8 }}>Prerequisites</h4>
                    <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>
                      No prior knowledge required. This section is suitable for all employees.
                    </p>
                  </div>
                </div>
              )}
              {tab === "notes" && <p>Notes section (can be built later).</p>}
            </div>
          </>
        ) : activeLecture ? (
          <>
            {/* Video if exists */}
            {activeLecture.videoUrl ? (
              <video
                key={activeLecture.id}
                controls
                style={{
                  width: "100%",
                  borderRadius: 12,
                  background: "#000",
                  maxHeight: 520,
                }}
              >
                <source src={activeLecture.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 320,
                  borderRadius: 12,
                  border: "1px solid #eee",
                  background: "#fafafa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Lecture Content</div>
                  <div style={{ marginTop: 6, opacity: 0.7 }}>Content will be added later</div>
                </div>
              </div>
            )}

            <h3 style={{ marginTop: 12 }}>{activeLecture.title}</h3>

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={() => setTab("overview")}>Overview</button>
              <button onClick={() => setTab("notes")}>Notes</button>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 12,
                minHeight: 120,
              }}
            >
              {tab === "overview" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <h4 style={{ marginTop: 0, marginBottom: 8 }}>About this lecture</h4>
                    <p style={{ lineHeight: 1.6, margin: 0 }}>
                      {activeLecture?.description || 
                        `This lecture covers "${activeLecture?.title}". Detailed content and resources will be added to help you understand this topic better. Check back soon for updates.`}
                    </p>
                  </div>
                  
                  <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Duration</div>
                      <div>{activeLecture?.duration || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Level</div>
                      <div>Beginner</div>
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>In this lecture:</div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      <li>Learn key concepts and principles</li>
                      <li>Understand practical applications</li>
                      <li>Get familiar with related tools</li>
                      <li>Prepare for hands-on exercises</li>
                    </ul>
                  </div>
                </div>
              )}

              {tab === "notes" && <p>Notes section (can be built later).</p>}
            </div>
          </>
        ) : (
          <p>No content selected.</p>
        )}
      </div>

      {/* RIGHT - Scrollable Sidebar */}
      <div style={{ 
        width: 360,
        height: "calc(100vh - 32px)",
        position: "sticky",
        top: 16
      }}>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            height: "100%",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Course content</h3>
          
          <div style={{ 
            flex: 1,
            overflowY: "auto",
            paddingRight: 4
          }}>
            {course.sections.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No content available.</p>
            ) : (
              course.sections.map((sec) => (
                <div key={sec.id || sec.title} style={{ marginBottom: 12 }}>
                  {/* ✅ Section title */}
                  <button
                    type="button"
                    onClick={() => {
                      if (sec.lectures && sec.lectures.length > 0) {
                        setActiveTitleOnly(null);
                        setActiveLecture(sec.lectures[0]);
                      } else {
                        setActiveLecture(null);
                        setActiveTitleOnly(sec.title);
                      }
                      setTab("overview");
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      fontWeight: 800,
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #eee",
                      background: activeTitleOnly === sec.title ? "#f3f6ff" : "#fff",
                      cursor: "pointer",
                      marginBottom: 6,
                    }}
                  >
                    {sec.title}
                  </button>

                  {/* ✅ Sub-items (lectures) */}
                  {sec.lectures && sec.lectures.length > 0 ? (
                    sec.lectures.map((lec) => (
                      <div
                        key={lec.id}
                        onClick={() => {
                          setActiveTitleOnly(null);
                          setActiveLecture(lec);
                          setTab("overview");
                        }}
                        style={{
                          cursor: "pointer",
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: activeLecture?.id === lec.id ? "#f3f6ff" : "transparent",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginLeft: 10,
                        }}
                      >
                        <span>{lec.title}</span>
                        <span style={{ opacity: 0.7 }}>{lec.duration}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ opacity: 0.7, paddingLeft: 10, fontSize: 13 }}>
                      (No sub-items yet)
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}