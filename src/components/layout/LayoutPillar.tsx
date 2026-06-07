'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { DataSource, Section, SectionConfig } from '@/types';
import { SectionList } from './SectionList';
import { SectionConfigurator } from './SectionConfigurator';
import { AddSectionDialog } from './AddSectionDialog';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function LayoutPillar() {
  const {
    catalog,
    setCatalog,
    activeSectionId,
    setActiveSectionId,
    dataSources,
    setDataSources,
    columns,
    setColumns,
    rows,
    setRows,
    dataPanelCollapsed,
    setDataPanelCollapsed,
  } = useAppStore();

  const [showAddSection, setShowAddSection] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setCatalog(json.data);
      }
    } catch {}
  }, [setCatalog]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Load data sources for column mapping
  const loadDataSources = useCallback(async () => {
    try {
      const res = await fetch('/api/datasources');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setDataSources(json.data);
      }
    } catch {}
  }, [setDataSources]);

  useEffect(() => {
    loadDataSources();
  }, [loadDataSources]);

  // Load rows/columns for active section's data source
  const loadSectionData = useCallback(async () => {
    if (!catalog?.sections) return;
    const activeSection = catalog.sections.find(s => s.id === activeSectionId);
    if (!activeSection) return;

    const config = activeSection.config as SectionConfig;
    const dsId = config.dataSourceId;
    if (!dsId) return;

    try {
      const res = await fetch(`/api/datasources/${dsId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setColumns(json.data.columns || []);
          setRows(json.data.rows || []);
        }
      }
    } catch {}
  }, [catalog, activeSectionId, setColumns, setRows]);

  useEffect(() => {
    loadSectionData();
  }, [loadSectionData]);

  const activeSection = catalog?.sections?.find(s => s.id === activeSectionId);

  const handleSectionUpdate = async (sectionId: string, config: SectionConfig) => {
    try {
      const res = await fetch(`/api/catalog/sections/${sectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (res.ok) {
        loadCatalog();
        toast.success('Section mise à jour');
      }
    } catch {
      toast.error('Erreur de mise à jour');
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Section list (collapsible) */}
      <div
        className={cn(
          'border-r border-border bg-card overflow-y-auto shrink-0 transition-all duration-300 ease-in-out',
          dataPanelCollapsed ? 'w-0 overflow-hidden border-r-0' : 'w-64'
        )}
      >
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Sections</h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowAddSection(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <SectionList
            sections={catalog?.sections || []}
            activeId={activeSectionId}
            onSelect={setActiveSectionId}
            onRefresh={loadCatalog}
          />
        </div>
      </div>

      {/* Right: Section configurator */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Expand button when panel is collapsed */}
        {dataPanelCollapsed && (
          <button
            onClick={() => setDataPanelCollapsed(false)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-5 h-10 flex items-center justify-center bg-card border border-border border-l-0 rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Afficher les sections"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
        {activeSection ? (
          <SectionConfigurator
            section={activeSection}
            dataSources={dataSources}
            columns={columns}
            rows={rows}
            onUpdate={(config) => handleSectionUpdate(activeSection.id, config)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <LayoutIcon className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Sélectionnez une section à configurer</p>
            <p className="text-xs mt-1">Ou créez une nouvelle section</p>
          </div>
        )}
      </div>

      <AddSectionDialog
        open={showAddSection}
        onOpenChange={setShowAddSection}
        catalogId={catalog?.id}
        onCreated={loadCatalog}
      />
    </div>
  );
}

function LayoutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <line x1="3" x2="21" y1="9" y2="9" />
      <line x1="9" x2="9" y1="21" y2="9" />
    </svg>
  );
}
