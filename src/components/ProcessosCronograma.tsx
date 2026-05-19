import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Plus, Check, Loader2, Trash2, CalendarDays } from "lucide-react";
import { format, addDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Processo {
  id: string;
  orcamento_id: string;
  nome: string;
  dias: number | null;
  ordem: number;
  concluido: boolean;
  concluido_em: string | null;
  created_at: string;
}

interface Props {
  orcamentoId: string;
  dataInicioProducao: string | null;
  onUpdateDataInicio: (date: string | null) => void;
}

function safeDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  try {
    const d = parseISO(s);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

interface SortableItemProps {
  processo: Processo;
  startDate: Date | null;
  isAndamento: boolean;
  isFirst: boolean;
  isLast: boolean;
  prevConcluido: boolean;
  onToggle: (p: Processo) => void;
  onDelete: (id: string) => void;
  onUpdateDias: (id: string, dias: number | null) => void;
}

function SortableProcessoItem({
  processo,
  startDate,
  isAndamento,
  isFirst,
  isLast,
  prevConcluido,
  onToggle,
  onDelete,
  onUpdateDias,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: processo.id });

  const [editingDias, setEditingDias] = useState(false);
  const [diasInput, setDiasInput] = useState(processo.dias?.toString() ?? "");

  useEffect(() => {
    setDiasInput(processo.dias?.toString() ?? "");
  }, [processo.dias]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const endDate =
    startDate && processo.dias != null ? addDays(startDate, processo.dias) : null;

  const nodeClass = processo.concluido
    ? "bg-black border-black"
    : isAndamento
    ? "bg-blue-500 border-blue-500"
    : "bg-white border-gray-300 dark:bg-background dark:border-gray-600";

  const lineAboveClass =
    processo.concluido && prevConcluido
      ? "bg-gray-900 dark:bg-gray-100"
      : "bg-gray-200 dark:bg-gray-700";

  const lineBelowClass = processo.concluido
    ? "bg-gray-900 dark:bg-gray-100"
    : "bg-gray-200 dark:bg-gray-700";

  const saveDias = () => {
    setEditingDias(false);
    const n = parseInt(diasInput, 10);
    if (!isNaN(n) && n > 0) {
      if (n !== processo.dias) onUpdateDias(processo.id, n);
    } else {
      // reset input to current value
      setDiasInput(processo.dias?.toString() ?? "");
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-3 group">
      {/* Timeline column */}
      <div className="flex flex-col items-center w-6 shrink-0">
        {!isFirst && <div className={`w-px h-3 shrink-0 ${lineAboveClass}`} />}
        <button
          onClick={() => onToggle(processo)}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all hover:scale-110 ${nodeClass}`}
          title={processo.concluido ? "Desmarcar como concluído" : "Marcar como concluído"}
        >
          {processo.concluido && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          {isAndamento && !processo.concluido && (
            <span className="w-2 h-2 rounded-full bg-white" />
          )}
        </button>
        {!isLast && <div className={`w-px flex-1 min-h-[28px] ${lineBelowClass}`} />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            title="Arrastar para reordenar"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <span
            className={`text-sm ${
              processo.concluido ? "line-through text-muted-foreground" : "font-medium"
            }`}
          >
            {processo.nome}
          </span>
          {processo.concluido ? (
            <Badge className="bg-green-600 text-[10px] px-1.5 py-0 h-4">Feito</Badge>
          ) : isAndamento ? (
            <Badge className="bg-blue-600 text-[10px] px-1.5 py-0 h-4">Andamento</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              Pendente
            </Badge>
          )}
          <button
            onClick={() => onDelete(processo.id)}
            className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
            title="Excluir etapa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dates + dias row */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5 ml-6 items-center">
          {startDate && endDate && (
            <span>
              {format(startDate, "dd/MM", { locale: ptBR })} →{" "}
              {format(endDate, "dd/MM", { locale: ptBR })}
            </span>
          )}

          {/* Inline dias edit */}
          {editingDias ? (
            <input
              type="number"
              min={1}
              value={diasInput}
              onChange={(e) => setDiasInput(e.target.value)}
              onBlur={saveDias}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveDias();
                if (e.key === "Escape") {
                  setEditingDias(false);
                  setDiasInput(processo.dias?.toString() ?? "");
                }
              }}
              className="w-14 h-5 text-xs border border-input rounded px-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          ) : processo.dias === null ? (
            <button
              onClick={() => { setEditingDias(true); setDiasInput(""); }}
              className="focus:outline-none"
            >
              <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500 text-[10px] px-1.5 py-0 h-4 cursor-pointer">
                Definir prazo
              </Badge>
            </button>
          ) : (
            <button
              onClick={() => setEditingDias(true)}
              className="hover:text-foreground transition-colors tabular-nums"
              title="Clique para editar"
            >
              {processo.dias} {processo.dias === 1 ? "dia" : "dias"}
            </button>
          )}

          {processo.concluido && processo.concluido_em && (
            <span className="text-green-600">
              Concluído em{" "}
              {format(parseISO(processo.concluido_em), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProcessosCronograma({
  orcamentoId,
  dataInicioProducao,
  onUpdateDataInicio,
}: Props) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaEtapaOpen, setNovaEtapaOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoDias, setNovoDias] = useState<string>("1");
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchProcessos = useCallback(async () => {
    const { data, error } = await supabase
      .from("orcamento_processos")
      .select("*")
      .eq("orcamento_id", orcamentoId)
      .order("ordem");
    if (!error) setProcessos((data || []) as Processo[]);
    setLoading(false);
  }, [orcamentoId]);

  useEffect(() => {
    fetchProcessos();
  }, [fetchProcessos]);

  // Calculate cumulative start dates (null dias stops cascade)
  const startDates: (Date | null)[] = (() => {
    const base = safeDate(dataInicioProducao);
    if (!base) return processos.map(() => null);
    let acc = 0;
    let blocked = false;
    return processos.map((p) => {
      if (blocked) return null;
      const d = addDays(base, acc);
      if (p.dias === null) {
        blocked = true;
      } else {
        acc += p.dias;
      }
      return d;
    });
  })();

  const hasNullDias = processos.some((p) => p.dias === null);
  const totalDias = processos.reduce((s, p) => s + (p.dias ?? 0), 0);

  const entregaPrevista = (() => {
    const base = safeDate(dataInicioProducao);
    if (!base || processos.length === 0 || hasNullDias) return null;
    return addDays(base, totalDias);
  })();

  const concluidos = processos.filter((p) => p.concluido).length;
  const progressPct =
    processos.length > 0 ? Math.round((concluidos / processos.length) * 100) : 0;

  const andamentoIdx = processos.findIndex((p) => !p.concluido);

  const handleToggle = useCallback(async (p: Processo) => {
    const novoConcluido = !p.concluido;
    const { data, error } = await supabase
      .from("orcamento_processos")
      .update({
        concluido: novoConcluido,
        concluido_em: novoConcluido ? new Date().toISOString() : null,
      })
      .eq("id", p.id)
      .select()
      .single();
    if (error) {
      toast.error("Erro ao atualizar etapa");
      return;
    }
    setProcessos((prev) => prev.map((x) => (x.id === p.id ? (data as Processo) : x)));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from("orcamento_processos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir etapa");
      return;
    }
    setProcessos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleUpdateDias = useCallback(async (id: string, dias: number | null) => {
    const { data, error } = await supabase
      .from("orcamento_processos")
      .update({ dias })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      toast.error("Erro ao atualizar dias");
      return;
    }
    setProcessos((prev) => prev.map((p) => (p.id === id ? (data as Processo) : p)));
  }, []);

  const handleAddNovaEtapa = useCallback(async () => {
    if (!novoNome.trim()) return;
    setSaving(true);
    const ordem =
      processos.length > 0 ? Math.max(...processos.map((p) => p.ordem)) + 1 : 0;
    const diasNum = parseInt(novoDias, 10);
    const { data, error } = await supabase
      .from("orcamento_processos")
      .insert({
        orcamento_id: orcamentoId,
        nome: novoNome.trim(),
        dias: !isNaN(diasNum) && diasNum > 0 ? diasNum : null,
        ordem,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao adicionar etapa");
      return;
    }
    setProcessos((prev) => [...prev, data as Processo]);
    setNovoNome("");
    setNovoDias("1");
    setNovaEtapaOpen(false);
  }, [orcamentoId, novoNome, novoDias, processos]);

  const handleGerarPadrao = useCallback(async () => {
    if (processos.length > 0) {
      if (
        !window.confirm(
          "Já existem etapas cadastradas. Deseja substituí-las pelos processos padrão?"
        )
      )
        return;
      await supabase
        .from("orcamento_processos")
        .delete()
        .eq("orcamento_id", orcamentoId);
    }
    setSaving(true);

    try {
      const { data: padrao, error: errPadrao } = await supabase
        .from("processo_padrao")
        .select("id, nome, ordem")
        .order("ordem");

      if (errPadrao || !padrao?.length) {
        console.error("Erro ao buscar processos padrão:", errPadrao);
        toast.info("Nenhum processo padrão configurado. Acesse Configurações para definir.");
        return;
      }

      const inserts = padrao.map((p, i) => ({
        orcamento_id: orcamentoId,
        nome: p.nome,
        dias: null,
        ordem: i,
      }));

      console.log("Dados a inserir:", JSON.stringify(inserts, null, 2));

      const { error: errInsert } = await supabase
        .from("orcamento_processos")
        .insert(inserts);

      if (errInsert) {
        console.error("Erro detalhado:", JSON.stringify(errInsert, null, 2));
        toast.error("Erro ao inserir processos");
        return;
      }

      await fetchProcessos();
      toast.success("Processos padrão gerados. Defina os dias de cada etapa.");
    } catch (err) {
      console.error("Exceção em handleGerarPadrao:", err);
      toast.error("Erro inesperado ao gerar processos padrão");
    } finally {
      setSaving(false);
    }
  }, [orcamentoId, processos]);

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
          supabase.from("orcamento_processos").update({ ordem: p.ordem }).eq("id", p.id)
        )
      );
    },
    [processos]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1.5">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Cronograma de Produção
            </CardTitle>
            {processos.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {concluidos} de {processos.length} etapas concluídas
                </span>
                <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Início:</span>
            <Input
              type="date"
              value={dataInicioProducao || ""}
              onChange={(e) => onUpdateDataInicio(e.target.value || null)}
              className="h-7 w-36 text-xs"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleGerarPadrao}
            disabled={saving}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            Gerar processos padrão
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setNovaEtapaOpen((v) => !v)}
          >
            <Plus className="w-3.5 h-3.5" />
            Nova etapa
          </Button>
        </div>

        {/* Inline new-etapa form */}
        {novaEtapaOpen && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
            <Input
              placeholder="Nome da etapa"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddNovaEtapa();
                if (e.key === "Escape") setNovaEtapaOpen(false);
              }}
              className="h-7 text-sm flex-1"
              autoFocus
            />
            <Input
              type="number"
              min={1}
              value={novoDias}
              onChange={(e) => setNovoDias(e.target.value)}
              className="h-7 text-sm w-20"
              placeholder="Dias"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAddNovaEtapa}
              disabled={saving || !novoNome.trim()}
            >
              Confirmar
            </Button>
          </div>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : processos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhuma etapa cadastrada. Use "Gerar processos padrão" ou "+ Nova etapa".
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
              <div className="pt-1">
                {processos.map((p, idx) => (
                  <SortableProcessoItem
                    key={p.id}
                    processo={p}
                    startDate={startDates[idx]}
                    isAndamento={idx === andamentoIdx}
                    isFirst={idx === 0}
                    isLast={idx === processos.length - 1}
                    prevConcluido={idx === 0 || processos[idx - 1].concluido}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onUpdateDias={handleUpdateDias}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Footer */}
        <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          {processos.length > 0 && (
            <span>
              Total: {totalDias} dias corridos
              {hasNullDias && (
                <span className="ml-1 text-yellow-600">(prazos incompletos)</span>
              )}
            </span>
          )}
          {entregaPrevista && processos.length > 0 && (
            <span className="font-medium text-foreground">
              Entrega prevista:{" "}
              {format(entregaPrevista, "dd 'de' MMM yyyy", { locale: ptBR })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 ml-auto"
            onClick={() => setNovaEtapaOpen((v) => !v)}
          >
            <Plus className="w-3 h-3" />
            Nova etapa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
