import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ShieldCheck, UserCheck, Mail, Phone } from "lucide-react";
import { Button, Pill, Avatar } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

const UserManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; user_id: string; pseudo: string } | null>(null);
  const [editingUser, setEditingUser] = useState<{ id: string; user_id: string; pseudo: string; email: string; telephone: string; role: "admin" | "user" } | null>(null);
  const [editPseudo, setEditPseudo] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelephone, setEditTelephone] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "user">("user");

  const { data: usersWithRoles = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: roles, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const activeProfiles = (profiles || []).filter((p: any) => !p.archived);
      const activeUserIds = new Set(activeProfiles.map((p: any) => p.user_id));
      return roles.filter(r => activeUserIds.has(r.user_id)).map(r => {
        const profile = activeProfiles.find((p: any) => p.user_id === r.user_id);
        return { ...r, pseudo: profile?.pseudo || "—", email: (profile as any)?.email || "", telephone: (profile as any)?.telephone || "" };
      });
    },
    enabled: !!user,
  });

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data: allProfiles, error: profileError } = await supabase.from("profiles").select("*");
      if (profileError) throw profileError;
      const { data: roles } = await supabase.from("user_roles").select("user_id");
      const roleUserIds = new Set(roles?.map(r => r.user_id) || []);
      return (allProfiles || []).filter((p: any) => !roleUserIds.has(p.user_id) && !p.archived).map(p => ({
        user_id: p.user_id, pseudo: p.pseudo || "—", email: (p as any).email || "",
        telephone: (p as any).telephone || "", created_at: p.created_at,
      }));
    },
    enabled: !!user,
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (!email || !password || !pseudo) throw new Error("Tous les champs sont obligatoires");
      if (password.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères");
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { pseudo } } });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Erreur lors de la création de l'utilisateur");
      const { error: roleError } = await supabase.from("user_roles").insert({ user_id: signUpData.user.id, role: selectedRole });
      if (roleError) throw roleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("Utilisateur créé avec succès");
      setDialogOpen(false);
      setEmail(""); setPassword(""); setPseudo(""); setSelectedRole("user");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role, userEmail, userPseudo }: { userId: string; role: "admin" | "user"; userEmail: string; userPseudo: string }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
      if (userEmail) {
        try { await supabase.functions.invoke("notify-user-access", { body: { userEmail, pseudo: userPseudo } }); }
        catch (err) { console.error("Failed to send confirmation email:", err); }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("Accès validé et email de confirmation envoyé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "admin" | "user" }) => {
      const { error } = await supabase.from("user_roles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Rôle mis à jour"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) throw new Error("Aucun utilisateur sélectionné");
      if (!editPseudo.trim()) throw new Error("Le pseudo est obligatoire");
      const { error: profileError } = await supabase.from("profiles").update({ pseudo: editPseudo.trim(), email: editEmail.trim(), telephone: editTelephone.trim() }).eq("user_id", editingUser.user_id);
      if (profileError) throw profileError;
      if (editingUser.user_id !== user?.id) {
        const { error: roleError } = await supabase.from("user_roles").update({ role: editRole }).eq("id", editingUser.id);
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("Utilisateur modifié avec succès");
      setEditDialogOpen(false); setEditingUser(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("archive_user" as any, { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("Utilisateur supprimé avec succès");
      setDeleteConfirmOpen(false); setUserToDelete(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEditDialog = (ur: { id: string; user_id: string; pseudo: string; email: string; telephone: string; role: "admin" | "user" }) => {
    setEditingUser(ur); setEditPseudo(ur.pseudo === "—" ? "" : ur.pseudo);
    setEditEmail(ur.email); setEditTelephone(ur.telephone); setEditRole(ur.role); setEditDialogOpen(true);
  };

  const roleTone = (role: "admin" | "user") => role === "admin" ? 'accent' as const : 'neutral' as const;
  const roleLabel = (role: "admin" | "user") => role === "admin" ? "Admin" : "Utilisateur";

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', fontSize: 11, color: 'var(--text-3)', fontWeight: 500,
    letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--border)',
  };

  const tdStyle: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: 'var(--text-1)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>Gestion des utilisateurs</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '3px 0 0' }}>Gérez les accès et les rôles</p>
        </div>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setDialogOpen(true)}>Inviter</Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Pending users */}
        {pendingUsers.length > 0 && (
          <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border-accent)', borderRadius: 'var(--r-4)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="users" size={15} color="var(--accent-bright)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>En attente de validation ({pendingUsers.length})</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Pseudo', 'Email', 'Téléphone', 'Inscription', 'Action'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(pu => (
                  <tr key={pu.user_id}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={pu.pseudo} size={28} />
                        <span style={{ fontWeight: 500 }}>{pu.pseudo}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        {pu.email || '—'}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {pu.telephone || '—'}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {new Date(pu.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td style={tdStyle}>
                      <Select
                        defaultValue="user"
                        onValueChange={role => assignRoleMutation.mutate({ userId: pu.user_id, role: role as "admin" | "user", userEmail: pu.email, userPseudo: pu.pseudo })}
                      >
                        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Attribuer un rôle" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Admin</div></SelectItem>
                          <SelectItem value="user"><div className="flex items-center gap-2"><UserCheck className="w-4 h-4" />Utilisateur</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Active users */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontSize: 13 }}>Chargement…</div>
        ) : usersWithRoles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Icon name="users" size={36} />
            Aucun utilisateur
          </div>
        ) : (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-4)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Utilisateurs actifs ({usersWithRoles.length})</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Pseudo', 'Email', 'Téléphone', 'Rôle', 'Date d\'ajout', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usersWithRoles.map((ur, i) => (
                  <tr
                    key={ur.id}
                    style={{ borderBottom: i < usersWithRoles.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={ur.pseudo} size={28} />
                        <span style={{ fontWeight: 500 }}>{ur.pseudo}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        {ur.email || '—'}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {ur.telephone || '—'}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <Select
                        value={ur.role}
                        onValueChange={v => updateRoleMutation.mutate({ id: ur.id, role: v as "admin" | "user" })}
                        disabled={ur.user_id === user?.id}
                      >
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <Pill tone="accent" size="sm" dot>Admin</Pill>
                          </SelectItem>
                          <SelectItem value="user">
                            <Pill tone="neutral" size="sm" dot>Utilisateur</Pill>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {new Date(ur.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                        <button
                          onClick={() => openEditDialog(ur)}
                          style={{ width: 28, height: 28, borderRadius: 'var(--r-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-3)'; }}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        {ur.user_id !== user?.id && (
                          <button
                            onClick={() => { setUserToDelete(ur); setDeleteConfirmOpen(true); }}
                            style={{ width: 28, height: 28, borderRadius: 'var(--r-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-soft)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvel utilisateur</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createUserMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1"><Label>Pseudo</Label><Input value={pseudo} onChange={e => setPseudo(e.target.value)} placeholder="Pseudo de l'utilisateur" required /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com" required /></div>
            <div className="space-y-1"><Label>Mot de passe</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required /></div>
            <div className="space-y-1">
              <Label>Rôle</Label>
              <Select value={selectedRole} onValueChange={v => setSelectedRole(v as "admin" | "user")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Admin – Accès complet</div></SelectItem>
                  <SelectItem value="user"><div className="flex items-center gap-2"><UserCheck className="w-4 h-4" />Utilisateur – Saisie de factures uniquement</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <button type="submit" disabled={createUserMutation.isPending} style={{ width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--accent-on)', border: 'none', borderRadius: 'var(--r-3)', fontWeight: 500, fontSize: 14, cursor: 'pointer', opacity: createUserMutation.isPending ? 0.7 : 1 }}>
              {createUserMutation.isPending ? "Création..." : "Créer l'utilisateur"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>Modifiez les informations du profil utilisateur.</DialogDescription>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); updateUserMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1"><Label>Pseudo</Label><Input value={editPseudo} onChange={e => setEditPseudo(e.target.value)} placeholder="Pseudo de l'utilisateur" required /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="email@exemple.com" /></div>
            <div className="space-y-1"><Label>Téléphone</Label><Input value={editTelephone} onChange={e => setEditTelephone(e.target.value)} placeholder="06 12 34 56 78" /></div>
            <div className="space-y-1">
              <Label>Rôle</Label>
              <Select value={editRole} onValueChange={v => setEditRole(v as "admin" | "user")} disabled={editingUser?.user_id === user?.id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Admin – Accès complet</div></SelectItem>
                  <SelectItem value="user"><div className="flex items-center gap-2"><UserCheck className="w-4 h-4" />Utilisateur – Saisie de factures uniquement</div></SelectItem>
                </SelectContent>
              </Select>
              {editingUser?.user_id === user?.id && <p className="text-xs text-muted-foreground">Vous ne pouvez pas modifier votre propre rôle</p>}
            </div>
            <button type="submit" disabled={updateUserMutation.isPending} style={{ width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--accent-on)', border: 'none', borderRadius: 'var(--r-3)', fontWeight: 500, fontSize: 14, cursor: 'pointer', opacity: updateUserMutation.isPending ? 0.7 : 1 }}>
              {updateUserMutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'utilisateur <strong>{userToDelete?.pseudo}</strong> sera retiré et n'aura plus accès. Ses données seront conservées pour audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToDelete && archiveUserMutation.mutate(userToDelete.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {archiveUserMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
