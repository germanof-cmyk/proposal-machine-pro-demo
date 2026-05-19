import { useState, useRef, useEffect } from "react";
import { Proposal, ProposalItem, ProposalClient } from "@/types/proposal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  proposal: Proposal;
  onChange: (p: Proposal) => void;
  searchClients?: (query: string) => ProposalClient[];
  onSelectClient?: (client: ProposalClient) => void;
}

const ProposalForm = ({ proposal, onChange, searchClients, onSelectClient }: Props) => {
  const [suggestions, setSuggestions] = useState<ProposalClient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const update = (field: keyof Proposal, value: unknown) =>
    onChange({ ...proposal, [field]: value });

  const updateClient = (field: string, value: string) => {
    onChange({ ...proposal, cliente: { ...proposal.cliente, [field]: value } });
    if (field === "nome" && searchClients) {
      const results = searchClients(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0 && value.length > 0);
    }
  };

  const selectClient = (client: ProposalClient) => {
    onChange({ ...proposal, cliente: { ...client } });
    setShowSuggestions(false);
    onSelectClient?.(client);
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateItem = (id: string, field: keyof ProposalItem, value: unknown) =>
    onChange({
      ...proposal,
      itens: proposal.itens.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    });

  const addItem = () =>
    onChange({
      ...proposal,
      itens: [
        ...proposal.itens,
        { id: String(Date.now()), produto: "", qtd: 1, valorUnit: 0 },
      ],
    });

  const removeItem = (id: string) =>
    onChange({ ...proposal, itens: proposal.itens.filter((i) => i.id !== id) });

  return (
    <div className="space-y-6">
      {/* Dados do orçamento */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Dados do Orçamento</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Nº</Label>
            <Input value={proposal.numero} onChange={(e) => update("numero", e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Emitido em</Label>
            <Input type="date" value={proposal.emitidoEm} onChange={(e) => update("emitidoEm", e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Válido até</Label>
            <Input type="date" value={proposal.validoAte} onChange={(e) => update("validoAte", e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Cliente</h3>
        <div className="space-y-2">
          <div className="relative" ref={suggestionsRef}>
            <Label className="text-xs">Nome</Label>
            <Input
              value={proposal.cliente.nome}
              onChange={(e) => updateClient("nome", e.target.value)}
              onFocus={() => {
                if (searchClients && proposal.cliente.nome) {
                  const results = searchClients(proposal.cliente.nome);
                  setSuggestions(results);
                  setShowSuggestions(results.length > 0);
                }
              }}
              className="h-8 text-sm"
              placeholder="Digite para buscar cliente cadastrado..."
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border last:border-0"
                    onClick={() => selectClient(c)}
                  >
                    <span className="font-medium">{c.nome}</span>
                    {c.cpfCnpj && <span className="text-muted-foreground ml-2 text-xs">({c.cpfCnpj})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={proposal.cliente.telefone} onChange={(e) => updateClient("telefone", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={proposal.cliente.email} onChange={(e) => updateClient("email", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">CPF/CNPJ</Label>
              <Input value={proposal.cliente.cpfCnpj} onChange={(e) => updateClient("cpfCnpj", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">RG/IE</Label>
              <Input value={proposal.cliente.rgIe} onChange={(e) => updateClient("rgIe", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Endereço</Label>
            <Input value={proposal.cliente.endereco} onChange={(e) => updateClient("endereco", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Bairro</Label>
              <Input value={proposal.cliente.bairro} onChange={(e) => updateClient("bairro", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input value={proposal.cliente.cidade} onChange={(e) => updateClient("cidade", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Input value={proposal.cliente.estado} onChange={(e) => updateClient("estado", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">CEP</Label>
              <Input value={proposal.cliente.cep} onChange={(e) => updateClient("cep", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Itens */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Itens</h3>
          <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {proposal.itens.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_60px_90px_32px] gap-2 items-end">
              <div>
                <Label className="text-xs">Produto/Serviço</Label>
                <Input value={item.produto} onChange={(e) => updateItem(item.id, "produto", e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Qtd</Label>
                <Input type="number" value={item.qtd} onChange={(e) => updateItem(item.id, "qtd", Number(e.target.value))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Valor Unit</Label>
                <Input type="number" value={item.valorUnit} onChange={(e) => updateItem(item.id, "valorUnit", Number(e.target.value))} className="h-8 text-sm" />
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeItem(item.id)} className="h-8 w-8 text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Financeiro */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Financeiro</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Desconto (R$)</Label>
            <Input type="number" value={proposal.desconto} onChange={(e) => update("desconto", Number(e.target.value))} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Frete (R$)</Label>
            <Input type="number" value={proposal.frete} onChange={(e) => update("frete", Number(e.target.value))} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Forma de Pagamento</Label>
            <Input value={proposal.formaPagamento} onChange={(e) => update("formaPagamento", e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Observações */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Observações</h3>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Frete (obs)</Label>
            <Input value={proposal.observacoesFrete} onChange={(e) => update("observacoesFrete", e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Outras observações</Label>
            <Textarea value={proposal.outrasObservacoes} onChange={(e) => update("outrasObservacoes", e.target.value)} className="text-sm" rows={2} />
          </div>
          <div>
            <Label className="text-xs">Criado por</Label>
            <Input value={proposal.criadoPor} onChange={(e) => update("criadoPor", e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalForm;
