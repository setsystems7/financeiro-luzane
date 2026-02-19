import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, Bell, Plus, Edit, Loader2, Users, Lock, Eye, EyeOff, HelpCircle, Save, Download } from 'lucide-react';
import { type SupportSection } from '@/components/layout/SupportButton';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles, useCreateUser, useUpdateProfile, useUpdatePassword } from '@/hooks/useUsers';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Settings() {
  const { user } = useAuth();
  const { settings, updateSettings } = useStoreSettings();
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const createUser = useCreateUser();
  const updateProfile = useUpdateProfile();
  const updatePassword = useUpdatePassword();

  // Store settings form
  const [storeName, setStoreName] = useState(settings.storeName);
  const [cnpj, setCnpj] = useState(settings.cnpj);
  const [address, setAddress] = useState(settings.address);

  // User management
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const handleSaveStoreSettings = () => {
    updateSettings({ storeName, cnpj, address });
    toast.success('Dados da loja salvos!');
  };

  const handleCreateUser = () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error('Preencha e-mail e senha');
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    createUser.mutate(
      {
        email: newUserEmail,
        password: newUserPassword,
        fullName: newUserName,
      },
      {
        onSuccess: () => {
          setIsCreateUserOpen(false);
          setNewUserEmail('');
          setNewUserPassword('');
          setNewUserName('');
        },
      }
    );
  };

  const handleEditUser = (profile: any) => {
    setSelectedProfile(profile);
    setEditName(profile.full_name || '');
    setEditRole(profile.role || 'user');
    setEditPassword('');
    setEditConfirmPassword('');
    setIsEditUserOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedProfile) return;

    // Validate password if provided
    if (editPassword) {
      if (editPassword !== editConfirmPassword) {
        toast.error('As senhas não conferem');
        return;
      }
      if (editPassword.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres');
        return;
      }
    }

    updateProfile.mutate(
      {
        id: selectedProfile.id,
        full_name: editName,
        role: editRole,
      },
      {
        onSuccess: async () => {
          // If password was provided, update it (only works for current user)
          if (editPassword && selectedProfile.user_id === user?.id) {
            await updatePassword.mutateAsync({ newPassword: editPassword });
          } else if (editPassword) {
            toast.info('Senha só pode ser alterada pelo próprio usuário');
          }
          setIsEditUserOpen(false);
          setSelectedProfile(null);
        },
      }
    );
  };

  const handleChangePassword = () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    updatePassword.mutate(
      { newPassword },
      {
        onSuccess: () => {
          setNewPassword('');
          setConfirmPassword('');
        },
      }
    );
  };

  const handleNotificationChange = (
    key: 'lowStockAlert' | 'dailySummary' | 'dueDateAlert',
    value: boolean
  ) => {
    updateSettings({ [key]: value } as any);
  };

  const settingsSupportSections: SupportSection[] = [
    { title: 'O que é o módulo Configurações', icon: HelpCircle, content: 'O módulo de Configurações permite personalizar o sistema: dados da loja, gerenciamento de usuários, alteração de senha e preferências de notificação.' },
    { title: 'Como alterar dados da loja', icon: Store, content: 'Na seção "Dados da Loja", preencha o nome da loja, CNPJ e endereço. Clique em "Salvar Alterações" para gravar. Esses dados são usados em etiquetas e relatórios.' },
    { title: 'Como gerenciar usuários', icon: Users, content: 'Na seção "Gerenciar Usuários", veja a lista de todos os usuários do sistema. Clique em "Novo Usuário" para cadastrar. Use o botão de editar para alterar nome e função (Administrador ou Usuário).' },
    { title: 'Como alterar senha', icon: Lock, content: 'Na seção "Alterar Minha Senha", insira a nova senha e confirme. A senha deve ter no mínimo 6 caracteres. Cada usuário só pode alterar a própria senha.' },
    { title: 'Notificações', icon: Bell, content: 'Configure quais notificações você deseja receber: alerta de estoque baixo, resumo diário de vendas e alerta de contas a vencer. Ative ou desative cada uma com o toggle.' },
  ];

  return (
    <MainLayout title="Configurações" subtitle="Personalize seu sistema" supportContent={{ moduleName: 'Configurações', sections: settingsSupportSections }}>
      <div className="space-y-6 max-w-4xl animate-fade-in">
        {/* Store Info */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-pink-dark" />
              </div>
              <div>
                <CardTitle>Dados da Loja</CardTitle>
                <CardDescription>Informações básicas do estabelecimento</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Nome da Loja</Label>
                <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
            <Button variant="pink" onClick={handleSaveStoreSettings}>
              Salvar Alterações
            </Button>
          </CardContent>
        </Card>

        {/* User Account */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-pink-dark" />
              </div>
              <div>
                <CardTitle>Alterar Minha Senha</CardTitle>
                <CardDescription>Atualize sua senha de acesso</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <Button variant="pink" onClick={handleChangePassword} disabled={updatePassword.isPending}>
              {updatePassword.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Atualizar Senha'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-pink-dark" />
                </div>
                <div>
                  <CardTitle>Gerenciar Usuários</CardTitle>
                  <CardDescription>Cadastre e gerencie os usuários do sistema</CardDescription>
                </div>
              </div>
              <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
                <DialogTrigger asChild>
                  <Button variant="pink">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input
                        placeholder="Nome do usuário"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail *</Label>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha *</Label>
                      <div className="relative">
                        <Input
                          type={showCreatePassword ? 'text' : 'password'}
                          placeholder="Mínimo 6 caracteres"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCreatePassword(!showCreatePassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                        Cancelar
                      </Button>
                      <Button variant="pink" onClick={handleCreateUser} disabled={createUser.isPending}>
                        {createUser.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Cadastrando...
                          </>
                        ) : (
                          'Cadastrar'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {profilesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum usuário cadastrado</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.full_name || 'Sem nome'}</TableCell>
                      <TableCell>{profile.email}</TableCell>
                      <TableCell>
                        <Badge variant={profile.role === 'admin' ? 'pink' : 'outline'}>
                          {profile.role === 'admin' ? 'Administrador' : 'Usuário'}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleEditUser(profile)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={selectedProfile?.email || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input placeholder="Nome do usuário" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Label>Nova Senha (opcional)</Label>
                <Input
                  type="password"
                  placeholder="Deixe vazio para manter a senha atual"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar Nova Senha</Label>
                <Input
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={editConfirmPassword}
                  onChange={(e) => setEditConfirmPassword(e.target.value)}
                />
                {selectedProfile?.user_id !== user?.id && editPassword && (
                  <p className="text-xs text-muted-foreground">
                    Nota: A senha só pode ser alterada pelo próprio usuário
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="pink" onClick={handleUpdateUser} disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Notifications */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-pink-dark" />
              </div>
              <div>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>Configure seus alertas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Alerta de estoque baixo</p>
                <p className="text-sm text-muted-foreground">
                  Receba notificação quando produtos atingirem estoque mínimo
                </p>
              </div>
              <Switch checked={settings.lowStockAlert} onCheckedChange={(v) => handleNotificationChange('lowStockAlert', v)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Resumo diário de vendas</p>
                <p className="text-sm text-muted-foreground">E-mail com resumo das vendas do dia</p>
              </div>
              <Switch checked={settings.dailySummary} onCheckedChange={(v) => handleNotificationChange('dailySummary', v)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Contas a vencer</p>
                <p className="text-sm text-muted-foreground">Alerta 3 dias antes do vencimento</p>
              </div>
              <Switch checked={settings.dueDateAlert} onCheckedChange={(v) => handleNotificationChange('dueDateAlert', v)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
