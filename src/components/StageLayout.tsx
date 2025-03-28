import React from 'react';

interface StageLayoutProps {
  children: React.ReactNode;
}

const StageLayout: React.FC<StageLayoutProps> = ({ children }) => {
  // Removed title prop, assuming header/nav is in root layout
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Removed h1 title - handled by root layout or page */}
      {/* Removed TODO for navigation - handled by root layout */}
      <div className="mt-4">
        {children}
      </div>
    </div>
  );
};

export default StageLayout;
