import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Terms from "./Terms";
import Privacy from "./Privacy";
import Support from "./Support";
import "./legal.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/support" element={<Support />} />
        <Route path="*" element={<Navigate to="/terms" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
