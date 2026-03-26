import { useEffect } from "react";
import { useNavigate } from "@remix-run/react";

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  }, [navigate]);

  return null;
}
