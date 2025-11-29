/**
 * TabNavigation component
 *
 * Tab navigation for switching between different form sections
 */

import React from 'react';
import { PktTabs, PktTabItem } from '@oslokommune/punkt-react';

export interface Tab {
  label: string;
  icon?: string;
}

export interface TabNavigationProps {
  tabs: Tab[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="pkt-tabs-wrapper">
      <PktTabs>
        {tabs.map((tab, idx) => (
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
