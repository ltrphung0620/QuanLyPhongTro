import React from 'react';
import './OrganizationSelector.css';

export default function OrganizationSelector({ organizations, onSelect, onLogout }) {
  return (
    <div className="org-selector-container">
      <div className="org-selector-card">
        <div className="org-selector-header">
          <div className="org-selector-logo">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1>Chọn tổ chức quản lý</h1>
          <p>Tài khoản của bạn quản lý nhiều tổ chức. Vui lòng chọn một tổ chức để bắt đầu làm việc.</p>
        </div>

        {organizations.length === 0 ? (
          <div className="org-selector-empty">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-icon">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
            <p>Tài khoản của bạn chưa được gán vào tổ chức nào hoặc tổ chức đã bị khóa.</p>
            <p className="empty-sub">Vui lòng liên hệ SuperAdmin để được hỗ trợ.</p>
          </div>
        ) : (
          <div className="org-selector-list">
            {organizations.map((org) => (
              <button 
                key={org.id} 
                className="org-selector-item" 
                onClick={() => onSelect(org.id)}
              >
                <div className="org-icon-wrapper">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div className="org-info">
                  <div className="org-name">{org.name}</div>
                  <div className="org-code">Mã: {org.code || `ORG${org.id}`}</div>
                </div>
                <div className="org-badge-area">
                  {org.hasFullAccess ? (
                    <span className="badge-full-access">Toàn quyền</span>
                  ) : (
                    <span className="badge-limited-access">Giới hạn</span>
                  )}
                  <svg className="chevron-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="org-selector-footer">
          <button className="btn-logout" onClick={onLogout}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
}
