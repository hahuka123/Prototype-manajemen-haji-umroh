import React from 'react';

export default function StatCard({ 
  title, 
  value, 
  subtext, 
  icon, 
  variant = 'primary' 
}) {
  return (
    <div className={`stat-card variant-${variant}`}>
      <div className="stat-info">
        <span className="stat-label">{title}</span>
        <span className="stat-value">{value}</span>
        {subtext && <span className="stat-subtext">{subtext}</span>}
      </div>
      {icon && (
        <div className="stat-icon-wrapper">
          {icon}
        </div>
      )}
    </div>
  );
}
