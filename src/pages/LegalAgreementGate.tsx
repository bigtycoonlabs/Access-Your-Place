import { useEffect } from "react";

const LegalAgreementGate = () => {
  useEffect(() => {
    window.location.replace("/pages/legal-agreement-gate.html");
  }, []);

  return null;
};

export default LegalAgreementGate;
