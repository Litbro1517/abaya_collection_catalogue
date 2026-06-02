'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Users, UserPlus, MoreVertical, Shield, ShieldCheck, ShieldAlert,
  Trash2, Ban, CheckCircle2, Loader2, Mail, Key, Crown, Edit3
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: string;
  status: string;
  googleSub: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  owner: { label: 'Propriétaire', icon: Crown, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  admin: { label: 'Admin', icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  editor: { label: 'Éditeur', icon: Shield, color: 'bg-sky-100 text-sky-800 border-sky-200' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'bg-green-100 text-green-800' },
  suspended: { label: 'Suspendu', color: 'bg-red-100 text-red-800' },
};

export function AdminUserManager() {
  const { adminUser } = useAppStore();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', name: '', role: 'admin', password: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const isOwner = adminUser?.role === 'owner';

  const loadAdmins = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/admins');
      if (res.ok) {
        const json = await res.json();
        setAdmins(json.data || []);
      }
    } catch {
      toast.error('Erreur lors du chargement des administrateurs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleAddAdmin = async () => {
    if (!addForm.email.trim()) {
      toast.error('L\'email est requis');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch('/api/auth/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addForm.email.trim(),
          name: addForm.name.trim() || undefined,
          role: addForm.role,
          password: addForm.password || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Administrateur ajouté avec succès');
        setAddForm({ email: '', name: '', role: 'admin', password: '' });
        setAddDialogOpen(false);
        loadAdmins();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur lors de l\'ajout');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editTarget || !newRole) return;
    setEditLoading(true);
    try {
      const res = await fetch('/api/auth/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: editTarget.id, role: newRole }),
      });
      if (res.ok) {
        toast.success(`Rôle modifié en ${ROLE_LABELS[newRole]?.label || newRole}`);
        setEditRoleDialogOpen(false);
        setEditTarget(null);
        loadAdmins();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur lors de la modification');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async (target: AdminUser) => {
    const newStatus = target.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch('/api/auth/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: target.id, status: newStatus }),
      });
      if (res.ok) {
        toast.success(newStatus === 'suspended'
          ? `${target.email} a été suspendu`
          : `${target.email} a été réactivé`
        );
        loadAdmins();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur lors de la modification');
      }
    } catch {
      toast.error('Erreur de connexion');
    }
  };

  const handleDeleteAdmin = async (target: AdminUser) => {
    try {
      const res = await fetch('/api/auth/admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: target.id }),
      });
      if (res.ok) {
        toast.success(`${target.email} a été supprimé`);
        loadAdmins();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur lors de la suppression');
      }
    } catch {
      toast.error('Erreur de connexion');
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email[0].toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-semibold">Gestion des administrateurs</h3>
        </div>
        {isOwner && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ajouter un administrateur</DialogTitle>
                <DialogDescription>
                  Créez un nouvel accès administrateur. L&apos;utilisateur pourra se connecter avec son email et le mot de passe défini ci-dessous, ou via Google OAuth si son email correspond.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-xs">Email *</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={addForm.email}
                      onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="admin@exemple.com"
                      className="h-9 pl-10 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Nom (optionnel)</Label>
                  <Input
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Prénom Nom"
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Rôle</Label>
                  <Select value={addForm.role} onValueChange={v => setAddForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin — Gestion complète</SelectItem>
                      <SelectItem value="editor">Éditeur — Modification du contenu uniquement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mot de passe (optionnel)</Label>
                  <div className="relative mt-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={addForm.password}
                      onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 8 caractères"
                      className="h-9 pl-10 text-xs"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Si aucun mot de passe n&apos;est défini, l&apos;utilisateur devra se connecter via Google OAuth.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
                <Button size="sm" onClick={handleAddAdmin} disabled={addLoading || !addForm.email.trim()}>
                  {addLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
                  Ajouter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Admin count summary */}
      <div className="flex gap-2 text-xs">
        <span className="text-muted-foreground">
          {admins.length} administrateur{admins.length > 1 ? 's' : ''}
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="text-green-700">{admins.filter(a => a.status === 'active').length} actif{admins.filter(a => a.status === 'active').length > 1 ? 's' : ''}</span>
        {admins.filter(a => a.status === 'suspended').length > 0 && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-red-700">{admins.filter(a => a.status === 'suspended').length} suspendu{admins.filter(a => a.status === 'suspended').length > 1 ? 's' : ''}</span>
          </>
        )}
      </div>

      {/* Admin list */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
        {admins.map(admin => {
          const roleInfo = ROLE_LABELS[admin.role] || ROLE_LABELS.editor;
          const statusInfo = STATUS_LABELS[admin.status] || STATUS_LABELS.active;
          const RoleIcon = roleInfo.icon;
          const isSelf = admin.id === adminUser?.id;

          return (
            <div
              key={admin.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                admin.status === 'suspended' ? 'bg-red-50/50 border-red-100 opacity-75' : 'bg-card border-border hover:bg-accent/50'
              }`}
            >
              {/* Avatar */}
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={admin.picture || undefined} />
                <AvatarFallback className="text-xs bg-gold/10 text-gold font-medium">
                  {getInitials(admin.name, admin.email)}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {admin.name || admin.email.split('@')[0]}
                  </span>
                  {isSelf && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-gold/10 text-gold border-gold/20">
                      Vous
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">{admin.email}</span>
                  {admin.googleSub && (
                    <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Google</span>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 gap-1 ${roleInfo.color}`}>
                  <RoleIcon className="w-2.5 h-2.5" />
                  {roleInfo.label}
                </Badge>
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${statusInfo.color}`}>
                  {statusInfo.label}
                </Badge>
              </div>

              {/* Actions */}
              {isOwner && !isSelf && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditTarget(admin);
                        setNewRole(admin.role);
                        setEditRoleDialogOpen(true);
                      }}
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-2" />
                      Modifier le rôle
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleToggleStatus(admin)}
                    >
                      {admin.status === 'active' ? (
                        <>
                          <Ban className="w-3.5 h-3.5 mr-2" />
                          Suspendre
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                          Réactiver
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={e => e.preventDefault()}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cet administrateur ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. L&apos;accès de <strong>{admin.email}</strong> sera définitivement supprimé, ainsi que toutes ses sessions actives.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteAdmin(admin)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      {/* Non-owner notice */}
      {!isOwner && (
        <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Seul le propriétaire peut gérer les administrateurs.</span>
          </div>
        </div>
      )}

      {/* Edit Role Dialog */}
      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Changer le rôle de {editTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-xs">Nouveau rôle</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="h-9 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">
                  <div className="flex items-center gap-2">
                    <Crown className="w-3 h-3 text-amber-600" />
                    Propriétaire — Contrôle total
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Admin — Gestion complète
                  </div>
                </SelectItem>
                <SelectItem value="editor">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-sky-600" />
                    Éditeur — Modification du contenu uniquement
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditRoleDialogOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleUpdateRole} disabled={editLoading || newRole === editTarget?.role}>
              {editLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
