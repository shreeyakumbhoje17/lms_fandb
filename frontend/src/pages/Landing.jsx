import "../styles/landing.css";
import { useNavigate } from "react-router-dom";
import LandingHeader from "../components/Landing/LandingHeader";
import LandingHero from "../components/Landing/LandingHero";
import WhyChoose from "../components/Landing/Landing_WhyChoose";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="ud-body">
      <LandingHeader />
      <LandingHero />
      <WhyChoose />
    </div>
  );
}
