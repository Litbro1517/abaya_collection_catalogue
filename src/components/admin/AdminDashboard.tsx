'use client';

import { useAppStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Settings,
  Database,
  Layout,
  BarChart3,
  Users,
  Shield,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface AdminDashboardProps {
  admin: {
    id: string;
    email: string;
    name: string | null;
    picture: string | null;
    role: string;
  };
}

export function AdminDashboard({ admin }: AdminDashboardProps) {
  const { setView, setIsAdmin, setAdminUser } = useAppStore();
  const [stats, setStats] = useState<{
    datasources: number;
    sections: number;
    products: number;
    admins: number;
  } | null>(null);

  useEffect(() => {
    // Sync admin state in Zustand store
    setIsAdmin(true);
    setAdminUser(admin);
  }, [admin, setIsAdmin, setAdminUser]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [dsRes, catRes, adminsRes] = await Promise.all([
          fetch('/api/datasources'),
          fetch('/api/catalog'),
          fetch('/api/auth/admins'),
        ]);

        let datasources = 0;
        let sections = 0;
        let products = 0;
        let admins = 0;

        if (dsRes.ok) {
          const dsJson = await dsRes.json();
          datasources = dsJson.data?.length || 0;
        }

        if (catRes.ok) {
          const catJson = await catRes.json();
          sections = catJson.data?.sections?.length || 0;
        }

        if (adminsRes.ok) {
          const adminsJson = await adminsRes.json();
          admins = adminsJson.data?.length || 0;
        }

        setStats({ datasources, sections, products, admins });
      } catch {
        // Stats not critical
      }
    };
    fetchStats();
  }, []);

  const cards = [
    {
      title: 'Éditeur de catalogue',
      description: 'Modifier les données, la mise en page et les paramètres du catalogue',
      icon: Layout,
      action: () => setView('builder'),
      color: '#1A3C34',
    },
    {
      title: 'Voir le catalogue',
      description: 'Ouvrir le catalogue public tel que le voient les visiteurs',
      icon: ExternalLink,
      href: '/',
      color: '#C9A84C',
    },
    {
      title: 'Gestion des administrateurs',
      description: "Ajouter, modifier ou supprimer des comptes d'administration",
      icon: Users,
      href: '/#admin-users',
      color: '#8B4513',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b" style={{ borderColor: 'rgba(201, 168, 76, 0.08)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => setView('builder')}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8D48B, #C9A84C)' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#1F1F1F', fontFamily: "'Playfair Display', serif" }}>
                Administration
              </h1>
              <p className="text-xs text-gray-500">
                {admin.name || admin.email} · <span className="capitalize font-medium" style={{ color: admin.role === 'owner' ? '#1A3C34' : '#8B4513' }}>{admin.role}</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Sources', value: stats.datasources, icon: Database, color: '#1A3C34' },
              { label: 'Sections', value: stats.sections, icon: Layout, color: '#C9A84C' },
              { label: 'Produits', value: stats.products, icon: BarChart3, color: '#8B4513' },
              { label: 'Admins', value: stats.admins, icon: Users, color: '#800020' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-5 border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  <span className="text-xs text-gray-500 font-medium">{s.label}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action Cards */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Accès rapides</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => {
            const content = (
              <>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${card.color}12` }}>
                  <card.icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <h3 className="font-semibold text-base mb-1" style={{ color: '#1F1F1F' }}>{card.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{card.description}</p>
              </>
            );

            if (card.action) {
              return (
                <button
                  key={card.title}
                  onClick={card.action}
                  className="bg-white rounded-xl p-6 border text-left hover:shadow-md transition-all duration-200 group"
                  style={{ borderColor: 'rgba(0,0,0,0.06)' }}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={card.title}
                href={card.href || '/'}
                className="bg-white rounded-xl p-6 border text-left hover:shadow-md transition-all duration-200 group block"
                style={{ borderColor: 'rgba(0,0,0,0.06)' }}
              >
                {content}
              </Link>
            );
          })}
        </div>

        {/* Security Notice */}
        <div className="mt-10 p-5 rounded-xl border" style={{ backgroundColor: 'rgba(26, 60, 52, 0.04)', borderColor: 'rgba(26, 60, 52, 0.1)' }}>
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#1A3C34' }} />
            <div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: '#1A3C34' }}>Accès sécurisé</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Cette zone est uniquement accessible aux administrateurs avec le rôle <strong>owner</strong> ou <strong>admin</strong>.
                Les éditeurs et les visiteurs non authentifiés sont automatiquement redirigés vers le catalogue public.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
