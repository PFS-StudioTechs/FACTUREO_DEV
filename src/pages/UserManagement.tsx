import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck, UserCheck, Pencil, UserPlus, Mail, Phone } from "lucide-react";

interface ProfileData {
  user_id: string;
  pseudo: string;
  email: string;
  telephone: string;
}

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

  // Fetch all users with roles (admin only via RLS), excluding archived
  const { data: usersWithRoles = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("*");
      if (error) throw error;

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      // Filter out archived users client-side since column is new
      const activeProfiles = (profiles || []).filter((p: any) => !p.archived);

      // Only return users whose profile is not archived
      const activeUserIds = new Set(activeProfiles.map((p) => p.user_id));

      return roles
        .filter((r) => activeUserIds.has(r.user_id))
        .map((r) => {
          const profile = activeProfiles.find((p) => p.user_id === r.user_id);
          return {
            ...r,
            pseudo: profile?.pseudo || "—",
            email: (profile as any)?.email || "",
            telephone: (profile as any)?.telephone || "",
          };
        });
    },
    enabled: !!user,
  });

  // Fetch pending users (have profile but no role), excluding archived
  const { data: pendingUsers = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data: allProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("*");
      if (profileError) throw profileError;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id");

      const roleUserIds = new Set(roles?.map((r) => r.user_id) || []);

      return (allProfiles || [])
        .filter((p: any) => !roleUserIds.has(p.user_id) && !p.archived)
        .map((p) => ({
          user_id: p.user_id,
          pseudo: p.pseudo || "—",
          email: (p as any).email || "",
          telephone: (p as any).telephone || "",
          created_at: p.created_at,
        }));
    },
    enabled: !!user,
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (!email || !password || !pseudo) throw new Error("Tous les champs sont obligatoires");
      if (password.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères");

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { pseudo } },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Erreur lors de la création de l'utilisateur");

      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: signUpData.user.id,
        role: selectedRole,
      });

      if (roleError) throw roleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("Utilisateur créé avec succès");
      setDialogOpen(false);
      setEmail("");
      setPassword("");
      setPseudo("");
      setSelectedRole("user");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role, userEmail, userPseudo }: { userId: string; role: "admin" | "user"; userEmail: string; userPseudo: string }) => {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role,
      });
      if (error) throw error;

      if (userEmail) {
        try {
          await supabase.functions.invoke("notify-user-access", {
            body: { userEmail, pseudo: userPseudo },
          });
        } catch (err) {
          console.error("Failed to send confirmation email:", err);
        }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Rôle mis à jour");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) throw new Error("Aucun utilisateur sélectionné");
      if (!editPseudo.trim()) throw new Error("Le pseudo est obligatoire");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          pseudo: editPseudo.trim(),
          email: editEmail.trim(),
          telephone: editTelephone.trim(),
        })
        .eq("user_id", editingUser.user_id);
      if (profileError) throw profileError;

      if (editingUser.user_id !== user?.id) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: editRole })
          .eq("id", editingUser.id);
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("Utilisateur modifié avec succès");
      setEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Soft delete: archive the profile via RPC
  const archiveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("archive_user" as any, { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("Utilisateur supprimé avec succès");
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEditDialog = (ur: { id: string; user_id: string; pseudo: string; email: string; telephone: string; role: "admin" | "user" }) => {
    setEditingUser(ur);
    setEditPseudo(ur.pseudo === "—" ? "" : ur.pseudo);
    setEditEmail(ur.email);
    setEditTelephone(ur.telephone);
    setEditRole(ur.role);
    setEditDialogOpen(true);
  };

  const openDeleteConfirm = (ur: { id: string; user_id: string; pseudo: string }) => {
    setUserToDelete(ur);
    setDeleteConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground">Gérez les accès et les rôles des utilisateurs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Ajouter un utilisateur</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvel utilisateur</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(); }} className="space-y-4">
              <div className="space-y-1">
                <Label>Pseudo</Label>
                <Input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo de l'utilisateur" required />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" required />
              </div>
              <div className="space-y-1">
                <Label>Mot de passe</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
              </div>
              <div className="space-y-1">
                <Label>Rôle</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "admin" | "user")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Admin – Accès complet</div>
                    </SelectItem>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2"><UserCheck className="w-4 h-4" />Utilisateur – Saisie de factures uniquement</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Création..." : "Créer l'utilisateur"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Users Section */}
      {pendingUsers.length > 0 && (
        <Card className="border-accent bg-accent/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Utilisateurs en attente de validation ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pseudo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Date d'inscription</TableHead>
                  <TableHead className="w-[200px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((pu) => (
                  <TableRow key={pu.user_id}>
                    <TableCell className="font-medium">{pu.pseudo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        {pu.email || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {pu.telephone || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(pu.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          defaultValue="user"
                          onValueChange={(role) =>
                            assignRoleMutation.mutate({
                              userId: pu.user_id,
                              role: role as "admin" | "user",
                              userEmail: pu.email,
                              userPseudo: pu.pseudo,
                            })
                          }
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Attribuer un rôle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Admin</div>
                            </SelectItem>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2"><UserCheck className="w-4 h-4" />Utilisateur</div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Existing Users */}
      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : usersWithRoles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun utilisateur</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Utilisateurs actifs ({usersWithRoles.length})</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pseudo</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Date d'ajout</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersWithRoles.map((ur) => (
                <TableRow key={ur.id}>
                  <TableCell className="font-medium">{ur.pseudo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      {ur.email || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {ur.telephone || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={ur.role}
                      onValueChange={(v) => updateRoleMutation.mutate({ id: ur.id, role: v as "admin" | "user" })}
                      disabled={ur.user_id === user?.id}
                    >
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <Badge variant="default" className="bg-primary">Admin</Badge>
                        </SelectItem>
                        <SelectItem value="user">
                          <Badge variant="secondary">Utilisateur</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(ur.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(ur)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {ur.user_id !== user?.id && (
                      <Button variant="ghost" size="icon" onClick={() => openDeleteConfirm(ur)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit user dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>Modifiez les informations du profil utilisateur.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateUserMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1">
              <Label>Pseudo</Label>
              <Input value={editPseudo} onChange={(e) => setEditPseudo(e.target.value)} placeholder="Pseudo de l'utilisateur" required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemple.com" />
            </div>
            <div className="space-y-1">
              <Label>Téléphone</Label>
              <Input value={editTelephone} onChange={(e) => setEditTelephone(e.target.value)} placeholder="06 12 34 56 78" />
            </div>
            <div className="space-y-1">
              <Label>Rôle</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as "admin" | "user")} disabled={editingUser?.user_id === user?.id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Admin – Accès complet</div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2"><UserCheck className="w-4 h-4" />Utilisateur – Saisie de factures uniquement</div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {editingUser?.user_id === user?.id && (
                <p className="text-xs text-muted-foreground">Vous ne pouvez pas modifier votre propre rôle</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'utilisateur <strong>{userToDelete?.pseudo}</strong> sera retiré de la liste et n'aura plus accès à l'application. Ses données seront conservées pour des raisons d'audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && archiveUserMutation.mutate(userToDelete.user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiveUserMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
