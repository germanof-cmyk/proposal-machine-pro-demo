import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa, type EmpresaConfig } from "@/hooks/useEmpresa";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Copy, GripVertical, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ProcessoPadrao {
  id: string;
  user_id: string;
  nome: string;
  ordem: number;
  created_at: string;
}

interface ProcessoCustoPadrao {
  id: string;
  user_id: string;
  nome: string;
  ordem: number;
}

interface ClientEmpresa {
  id: string;
  nome: string;
  email: string;
  portal_token: string | null;
  emailRepresentante: string;
  whatsappRepresentante: string;
  emailAlertas: string;
  whatsappAlertas: string;
}

function SortableProcessoRow({
  processo,
  onDelete,
}: {
  processo: { id: string; nome: string };
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: processo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2.5 border rounded-lg bg-card group hover:bg-muted/40 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
        title="Arrastar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="flex-1 text-sm">{processo.nome}</span>
      <button
        onClick={() => onDelete(processo.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
        title="Remover processo"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const PORTAL_URL = "centralpropostas.vercel.app/portal/login";

export default function Configuracoes() {
  const { user } = useAuth();
  const { empresa: empresaData } = useEmpresa();

  // Empresa config state
  const [formEmpresaConfig, setFormEmpresaConfig] = useState<EmpresaConfig>(empresaData);
  const [savingEmpresaConfig, setSavingEmpresaConfig] = useState(false);

  useEffect(() => {
    setFormEmpresaConfig(empresaData);
  }, [empresaData]);

  const handleSaveEmpresaConfig = useCallback(async () => {
    setSavingEmpresaConfig(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      setSavingEmpresaConfig(false);
      toast.error("Usuário não autenticado");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("empresa_config") as any)
      .upsert(
        {
          user_id: currentUser.id,
          nome: formEmpresaConfig.nome,
          razao_social: formEmpresaConfig.razao_social,
          cnpj: formEmpresaConfig.cnpj,
          cidade: formEmpresaConfig.cidade,
          estado: formEmpresaConfig.estado,
          telefone: formEmpresaConfig.telefone,
          email: formEmpresaConfig.email,
          site: formEmpresaConfig.site,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: false }
      );
    setSavingEmpresaConfig(false);
    if (error) {
      console.error("Erro detalhado:", JSON.stringify(error, null, 2));
      toast.error("Erro ao salvar dados da empresa");
    } else {
      toast.success("Dados da empresa salvos!");
    }
  }, [formEmpresaConfig]);

  const [processos, setProcessos] = useState<ProcessoPadrao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  // Processos de custo padrão
  const [processosCusto, setProcessosCusto] = useState<ProcessoCustoPadrao[]>([]);
  const [loadingCusto, setLoadingCusto] = useState(true);
  const [savingCusto, setSavingCusto] = useState(false);
  const [addingNewCusto, setAddingNewCusto] = useState(false);
  const [novoNomeCusto, setNovoNomeCusto] = useState("");

  // Client companies state
  const [empresas, setEmpresas] = useState<ClientEmpresa[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [addingEmpresa, setAddingEmpresa] = useState(false);
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [formEmpresa, setFormEmpresa] = useState({
    nome: "",
    email: "",
    senha: "",
    emailAlertas: "",
    whatsappAlertas: "",
  });

  // Edit empresa state
  const [editingEmpresaId, setEditingEmpresaId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: "",
    email: "",
    emailRepresentante: "",
    whatsappRepresentante: "",
    emailAlertas: "",
    whatsappAlertas: "",
  });

  const startEditEmpresa = useCallback((emp: ClientEmpresa) => {
    setEditingEmpresaId(emp.id);
    setEditForm({
      nome: emp.nome,
      email: emp.email === "—" ? "" : emp.email,
      emailRepresentante: emp.emailRepresentante,
      whatsappRepresentante: emp.whatsappRepresentante,
      emailAlertas: emp.emailAlertas,
      whatsappAlertas: emp.whatsappAlertas,
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchProcessos = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("processo_padrao")
      .select("*")
      .eq("user_id", user.id)
      .order("ordem");
    if (!error) setProcessos((data || []) as ProcessoPadrao[]);
    setLoading(false);
  }, [user]);

  const fetchEmpresas = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: companies } = await (supabase.from("client_companies") as any)
      .select("id, nome, portal_token");
    if (!companies?.length) {
      setEmpresas([]);
      setLoadingEmpresas(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase.from("client_users") as any)
      .select("id, company_id, email");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: alertas } = await (supabase.from("alertas_config") as any)
      .select("company_id, email_representante, whatsapp_representante, email_cliente, whatsapp_cliente");

    const built: ClientEmpresa[] = (companies || []).map((c: any) => {
      const u = (users || []).find((u: any) => u.company_id === c.id);
      const a = (alertas || []).find((a: any) => a.company_id === c.id);
      return {
        id: c.id,
        nome: c.nome,
        email: u?.email ?? "—",
        portal_token: c.portal_token ?? null,
        emailRepresentante: a?.email_representante ?? "",
        whatsappRepresentante: a?.whatsapp_representante ?? "",
        emailAlertas: a?.email_cliente ?? "",
        whatsappAlertas: a?.whatsapp_cliente ?? "",
      };
    });
    setEmpresas(built);
    setLoadingEmpresas(false);
  }, []);

  const handleSaveEditEmpresa = useCallback(async (emp: ClientEmpresa) => {
    setSavingEdit(true);
    const emailChanged = editForm.email.trim().toLowerCase() !== emp.email.toLowerCase();

    console.log('Salvando empresa:', emp.id, editForm);

    // 1. Update client_companies name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errNome } = await (supabase.from("client_companies") as any)
      .update({ nome: editForm.nome.trim() })
      .eq("id", emp.id);

    if (errNome) {
      console.error('Erro ao atualizar empresa:', errNome);
      toast.error("Erro ao atualizar nome da empresa");
      setSavingEdit(false);
      return;
    }
    console.log('1. client_companies atualizado OK');

    // 2. Update client_users email if changed
    if (emailChanged && editForm.email.trim()) {
      console.log('2. Atualizando email:', editForm.email.trim().toLowerCase());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: errEmail } = await (supabase.from("client_users") as any)
        .update({ email: editForm.email.trim().toLowerCase() })
        .eq("company_id", emp.id);

      if (errEmail) {
        console.error('Erro ao atualizar usuário:', errEmail);
        toast.error("Erro ao atualizar email do usuário");
        setSavingEdit(false);
        return;
      }
      console.log('2. client_users atualizado OK');
    }

    // 3. Upsert alertas_config
    const alertasPayload = {
      company_id: emp.id,
      email_representante: editForm.emailRepresentante.trim() || null,
      whatsapp_representante: editForm.whatsappRepresentante.trim() || null,
      email_cliente: editForm.emailAlertas.trim() || null,
      whatsapp_cliente: editForm.whatsappAlertas.trim() || null,
    };
    console.log('3. Upsert alertas_config:', alertasPayload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errAlerta } = await (supabase.from("alertas_config") as any)
      .upsert(alertasPayload, { onConflict: "company_id", ignoreDuplicates: false });

    if (errAlerta) {
      console.error('Erro ao atualizar alertas:', errAlerta);
      toast.error("Erro ao atualizar configurações de alerta");
      setSavingEdit(false);
      return;
    }
    console.log('3. alertas_config atualizado OK');

    setSavingEdit(false);
    setEditingEmpresaId(null);

    if (emailChanged && editForm.email.trim()) {
      toast.success("Dados atualizados! O email de login só será atualizado no próximo acesso.");
    } else {
      toast.success("Empresa atualizada!");
    }

    await fetchEmpresas();
  }, [editForm, fetchEmpresas]);

  const fetchProcessosCusto = useCallback(async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("processo_custo_padrao") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("ordem");
    if (!error) setProcessosCusto((data || []) as ProcessoCustoPadrao[]);
    setLoadingCusto(false);
  }, [user]);

  useEffect(() => {
    fetchProcessos();
  }, [fetchProcessos]);

  useEffect(() => {
    fetchProcessosCusto();
  }, [fetchProcessosCusto]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  const handleAddCusto = useCallback(async () => {
    if (!novoNomeCusto.trim() || !user) return;
    setSavingCusto(true);
    const ordem =
      processosCusto.length > 0 ? Math.max(...processosCusto.map((p) => p.ordem)) + 1 : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("processo_custo_padrao") as any)
      .insert({ user_id: user.id, nome: novoNomeCusto.trim(), ordem })
      .select()
      .single();
    setSavingCusto(false);
    if (error) { toast.error("Erro ao adicionar processo"); return; }
    setProcessosCusto((prev) => [...prev, data as ProcessoCustoPadrao]);
    setNovoNomeCusto("");
    setAddingNewCusto(false);
  }, [novoNomeCusto, user, processosCusto]);

  const handleDeleteCusto = useCallback(async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("processo_custo_padrao") as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao remover processo"); return; }
    setProcessosCusto((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleDragEndCusto = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = processosCusto.findIndex((p) => p.id === active.id);
      const newIdx = processosCusto.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(processosCusto, oldIdx, newIdx).map((p, i) => ({
        ...p,
        ordem: i,
      }));
      setProcessosCusto(reordered);
      await Promise.all(
        reordered.map((p) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("processo_custo_padrao") as any).update({ ordem: p.ordem }).eq("id", p.id)
        )
      );
    },
    [processosCusto]
  );

  const handleAdd = useCallback(async () => {
    if (!novoNome.trim() || !user) return;
    setSaving(true);
    const ordem =
      processos.length > 0 ? Math.max(...processos.map((p) => p.ordem)) + 1 : 0;
    const { data, error } = await supabase
      .from("processo_padrao")
      .insert({ user_id: user.id, nome: novoNome.trim(), ordem })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao adicionar processo");
      return;
    }
    setProcessos((prev) => [...prev, data as ProcessoPadrao]);
    setNovoNome("");
    setAddingNew(false);
  }, [novoNome, user, processos]);

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from("processo_padrao").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover processo");
      return;
    }
    setProcessos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = processos.findIndex((p) => p.id === active.id);
      const newIdx = processos.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(processos, oldIdx, newIdx).map((p, i) => ({
        ...p,
        ordem: i,
      }));
      setProcessos(reordered);
      await Promise.all(
        reordered.map((p) =>
          supabase.from("processo_padrao").update({ ordem: p.ordem }).eq("id", p.id)
        )
      );
    },
    [processos]
  );

  const handleAddEmpresa = useCallback(async () => {
    const { nome, email, senha, emailAlertas, whatsappAlertas } = formEmpresa;
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      toast.error("Preencha nome, email e senha");
      return;
    }
    setSavingEmpresa(true);

    try {
      // Save current admin session before creating user
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      // 1. Create company
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: company, error: errCompany } = await (supabase.from("client_companies") as any)
        .insert({ nome: nome.trim() })
        .select()
        .single();

      if (errCompany || !company) {
        toast.error("Erro ao criar empresa");
        return;
      }

      // 2. Create client user record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: errUser } = await (supabase.from("client_users") as any).insert({
        company_id: company.id,
        email: email.trim().toLowerCase(),
      });

      if (errUser) {
        toast.error("Erro ao criar usuário: " + errUser.message);
        return;
      }

      // 3. Create alertas_config
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("alertas_config") as any).insert({
        company_id: company.id,
        email_cliente: emailAlertas.trim() || null,
        whatsapp_cliente: whatsappAlertas.trim() || null,
      });

      // 4. Create Supabase Auth user (signUp + restore admin session)
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      // Restore admin session immediately
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      if (signUpError) {
        toast.error("Empresa criada mas erro ao criar login: " + signUpError.message);
      } else {
        toast.success(`Empresa "${nome}" criada com sucesso!`);
      }

      setFormEmpresa({ nome: "", email: "", senha: "", emailAlertas: "", whatsappAlertas: "" });
      setAddingEmpresa(false);
      fetchEmpresas();
    } catch (err) {
      toast.error("Erro inesperado ao criar empresa");
    } finally {
      setSavingEmpresa(false);
    }
  }, [formEmpresa, fetchEmpresas]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${PORTAL_URL}`);
    toast.success("Link copiado!");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppNav />

      <main className="flex-1 container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie as configurações da sua conta.
          </p>
        </div>

        {/* Dados da Empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Dados da Empresa
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Informações exibidas nos portais e nos documentos impressos.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome fantasia</Label>
                <Input
                  placeholder="Ex: Frotaly"
                  value={formEmpresaConfig.nome}
                  onChange={(e) => setFormEmpresaConfig((f) => ({ ...f, nome: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Razão social</Label>
                <Input
                  placeholder="Ex: Frotaly"
                  value={formEmpresaConfig.razao_social}
                  onChange={(e) => setFormEmpresaConfig((f) => ({ ...f, razao_social: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={formEmpresaConfig.cnpj}
                  onChange={(e) => setFormEmpresaConfig((f) => ({ ...f, cnpj: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <Input
                  placeholder="+55 47 99999-9999"
                  value={formEmpresaConfig.telefone ?? ""}
                  onChange={(e) => setFormEmpresaConfig((f) => ({ ...f, telefone: e.target.value || null }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input
                  placeholder="Ex: Joinville"
                  value={formEmpresaConfig.cidade}
                  onChange={(e) => setFormEmpresaConfig((f) => ({ ...f, cidade: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Input
                  placeholder="Ex: SC"
                  value={formEmpresaConfig.estado}
                  onChange={(e) => setFormEmpresaConfig((f) => ({ ...f, estado: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  placeholder="contato@empresa.com.br"
                  value={formEmpresaConfig.email ?? ""}
                  onChange={(e) => setFormEmpresaConfig((f) => ({ ...f, email: e.target.value || null }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Site</Label>
                <Input
                  placeholder="www.empresa.com.br"
                  value={formEmpresaConfig.site ?? ""}
                  onChange={(e) => setFormEmpresaConfig((f) => ({ ...f, site: e.target.value || null }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                className="h-7 text-xs bg-[#1a1a1a] hover:bg-[#333] text-white border-0"
                onClick={handleSaveEmpresaConfig}
                disabled={savingEmpresaConfig}
              >
                {savingEmpresaConfig && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Processos padrão */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Processos padrão
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setAddingNew((v) => !v)}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar processo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Defina os processos que serão gerados automaticamente no cronograma de produção.
              Os dias serão definidos individualmente em cada orçamento.
            </p>
          </CardHeader>

          <CardContent className="space-y-2">
            {addingNew && (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                <Input
                  placeholder="Nome do processo"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") {
                      setAddingNew(false);
                      setNovoNome("");
                    }
                  }}
                  className="h-7 text-sm flex-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleAdd}
                  disabled={saving || !novoNome.trim()}
                >
                  {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Confirmar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setAddingNew(false); setNovoNome(""); }}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : processos.length === 0 && !addingNew ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhum processo padrão cadastrado. Clique em "+ Adicionar processo".
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={processos.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {processos.map((p) => (
                      <SortableProcessoRow
                        key={p.id}
                        processo={p}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>

        {/* Processos de custo padrão */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Processos de custo padrão
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setAddingNewCusto((v) => !v)}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar processo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Processos gerados automaticamente na aba de custos de cada orçamento.
            </p>
          </CardHeader>

          <CardContent className="space-y-2">
            {addingNewCusto && (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                <Input
                  placeholder="Nome do processo"
                  value={novoNomeCusto}
                  onChange={(e) => setNovoNomeCusto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCusto();
                    if (e.key === "Escape") {
                      setAddingNewCusto(false);
                      setNovoNomeCusto("");
                    }
                  }}
                  className="h-7 text-sm flex-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleAddCusto}
                  disabled={savingCusto || !novoNomeCusto.trim()}
                >
                  {savingCusto && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Confirmar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setAddingNewCusto(false); setNovoNomeCusto(""); }}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {loadingCusto ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : processosCusto.length === 0 && !addingNewCusto ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhum processo cadastrado. Ex: MP, CNC, Torno, Acabamento…
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndCusto}
              >
                <SortableContext
                  items={processosCusto.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {processosCusto.map((p) => (
                      <SortableProcessoRow
                        key={p.id}
                        processo={p}
                        onDelete={handleDeleteCusto}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>

        {/* Empresas clientes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Empresas clientes
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setAddingEmpresa((v) => !v)}
              >
                <Plus className="w-3.5 h-3.5" />
                Nova empresa
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cadastre empresas para acesso ao portal de fabricação.
            </p>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Add empresa form */}
            {addingEmpresa && (
              <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nova empresa
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome da empresa *</Label>
                    <Input
                      placeholder="Ex: Metalúrgica Alfa"
                      value={formEmpresa.nome}
                      onChange={(e) =>
                        setFormEmpresa((f) => ({ ...f, nome: e.target.value }))
                      }
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email de acesso *</Label>
                    <Input
                      type="email"
                      placeholder="cliente@empresa.com"
                      value={formEmpresa.email}
                      onChange={(e) =>
                        setFormEmpresa((f) => ({ ...f, email: e.target.value }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Senha *</Label>
                    <Input
                      type="password"
                      placeholder="Senha de acesso"
                      value={formEmpresa.senha}
                      onChange={(e) =>
                        setFormEmpresa((f) => ({ ...f, senha: e.target.value }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email para alertas</Label>
                    <Input
                      type="email"
                      placeholder="alertas@empresa.com"
                      value={formEmpresa.emailAlertas}
                      onChange={(e) =>
                        setFormEmpresa((f) => ({ ...f, emailAlertas: e.target.value }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">WhatsApp para alertas</Label>
                    <Input
                      placeholder="+55 47 99999-9999"
                      value={formEmpresa.whatsappAlertas}
                      onChange={(e) =>
                        setFormEmpresa((f) => ({
                          ...f,
                          whatsappAlertas: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-[#1a1a1a] hover:bg-[#333] text-white border-0"
                    onClick={handleAddEmpresa}
                    disabled={
                      savingEmpresa ||
                      !formEmpresa.nome.trim() ||
                      !formEmpresa.email.trim() ||
                      !formEmpresa.senha.trim()
                    }
                  >
                    {savingEmpresa && (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    )}
                    Criar empresa
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setAddingEmpresa(false);
                      setFormEmpresa({
                        nome: "",
                        email: "",
                        senha: "",
                        emailAlertas: "",
                        whatsappAlertas: "",
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* List */}
            {loadingEmpresas ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : empresas.length === 0 && !addingEmpresa ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhuma empresa cadastrada. Clique em "+ Nova empresa".
              </p>
            ) : (
              <div className="space-y-1.5">
                {empresas.map((emp) => {
                  const pedidosUrl = emp.portal_token
                    ? `https://centralpropostas.vercel.app/pedidos/${emp.portal_token}`
                    : null;
                  const isEditing = editingEmpresaId === emp.id;
                  return (
                    <div
                      key={emp.id}
                      className="border rounded-lg bg-card overflow-hidden"
                    >
                      {/* Card header row */}
                      <div className="px-3 py-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{emp.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-muted-foreground shrink-0"
                            onClick={() => isEditing ? setEditingEmpresaId(null) : startEditEmpresa(emp)}
                          >
                            <Pencil className="w-3 h-3" />
                            Editar
                          </Button>
                          {pedidosUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(pedidosUrl);
                                toast.success("Link copiado!");
                              }}
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copiar link
                            </Button>
                          )}
                        </div>
                        {pedidosUrl && (
                          <p
                            className="text-[11px] text-muted-foreground font-mono truncate ml-7 px-2 py-1 rounded"
                            style={{ background: "#f5f5f5" }}
                          >
                            {pedidosUrl}
                          </p>
                        )}
                        {!pedidosUrl && (
                          <p className="text-[11px] text-muted-foreground ml-7 italic">
                            Execute o SQL do banco para gerar o portal_token desta empresa
                          </p>
                        )}
                      </div>

                      {/* Inline edit form */}
                      {isEditing && (
                        <div
                          className="px-3 pb-3 pt-2 space-y-3"
                          style={{ borderTop: "0.5px solid hsl(var(--border))", background: "#fafafa" }}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Editar empresa
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1 col-span-2">
                              <Label className="text-xs">Nome da empresa</Label>
                              <Input
                                value={editForm.nome}
                                onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                                className="h-8 text-sm"
                                autoFocus
                              />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <Label className="text-xs">Email de acesso</Label>
                              <Input
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-1">
                                Alertas — Representante
                              </p>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Email</Label>
                              <Input
                                type="email"
                                placeholder="rep@empresa.com"
                                value={editForm.emailRepresentante}
                                onChange={(e) => setEditForm((f) => ({ ...f, emailRepresentante: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">WhatsApp (ex: 5547999999999)</Label>
                              <Input
                                placeholder="5547999999999"
                                value={editForm.whatsappRepresentante}
                                onChange={(e) => setEditForm((f) => ({ ...f, whatsappRepresentante: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-1">
                                Alertas — Cliente
                              </p>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Email</Label>
                              <Input
                                type="email"
                                placeholder="cliente@empresa.com"
                                value={editForm.emailAlertas}
                                onChange={(e) => setEditForm((f) => ({ ...f, emailAlertas: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">WhatsApp (ex: 5547999999999)</Label>
                              <Input
                                placeholder="5547999999999"
                                value={editForm.whatsappAlertas}
                                onChange={(e) => setEditForm((f) => ({ ...f, whatsappAlertas: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-[#1a1a1a] hover:bg-[#333] text-white border-0"
                              onClick={() => handleSaveEditEmpresa(emp)}
                              disabled={savingEdit || !editForm.nome.trim()}
                            >
                              {savingEdit && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                              Salvar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setEditingEmpresaId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
