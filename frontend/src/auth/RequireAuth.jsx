import { useIsAuthenticated } from "@azure/msal-react";
import { Navigate } from "react-router-dom";

export default function RequireAuth({ children }) {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

