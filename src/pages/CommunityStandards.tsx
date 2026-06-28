import { useEffect } from "react";

const CommunityStandards = () => {
  useEffect(() => {
    // Redirect to the static HTML version which has full styling
    window.location.replace("/pages/community-standards.html");
  }, []);

  return null;
};

export default CommunityStandards;
