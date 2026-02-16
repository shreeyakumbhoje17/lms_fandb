import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CoursePlayer from "./pages/CoursePlayer";
import AuthCallback from "./pages/AuthCallback";

import Upload from "./pages/Upload";
import CreatorCourseBuilder from "./pages/CreatorCourseBuilder";

import RequireAuth from "./auth/RequireAuth";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Authenticated */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/course/:courseId"
          element={
            <RequireAuth>
              <CoursePlayer />
            </RequireAuth>
          }
        />

        {/* ✅ Create / Upload */}
        <Route
          path="/upload"
          element={
            <RequireAuth>
              <Upload />
            </RequireAuth>
          }
        />

        {/* ✅ Course Builder */}
        <Route
          path="/creator/courses/:id"
          element={
            <RequireAuth>
              <CreatorCourseBuilder />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
