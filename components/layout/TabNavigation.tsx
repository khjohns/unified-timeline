import React from 'react';
import { PktTabs, PktTabItem } from '@oslokommune/punkt-react';
import { TABS } from '../../config';

interface TabNavigationProps {
  activeTab: number;
  onTabChange: (index: number) => void;
}

/**
 * Tab navigation component
 *
 * Renders the main tab navigation for the application.
 * Supports keyboard navigation and accessibility.
 *
 * @param activeTab - Currently active tab index
 * @param onTabChange - Callback when tab is changed
 */
const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="pkt-tabs-wrapper">
      <PktTabs>
        {TABS.map((tab, idx) => (
          <PktTabItem
            key={tab.label}
            active={activeTab === idx}
            onClick={() => {
              onTabChange(idx);
              window.scrollTo(0, 0);
            }}
            icon={tab.icon}
            index={idx}
          >
            {tab.label}
          </PktTabItem>
        ))}
      </PktTabs>
    </div>
  );
};

export default TabNavigation;
