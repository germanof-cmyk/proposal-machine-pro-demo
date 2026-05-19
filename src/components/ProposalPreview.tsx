import { Proposal } from "@/types/proposal";
import logo from "@/assets/logo-3d-usinagem.png";

interface Props {
  proposal: Proposal;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
};

const ProposalPreview = ({ proposal }: Props) => {
  const subtotal = proposal.itens.reduce((s, i) => s + i.qtd * i.valorUnit, 0);
  const total = subtotal - proposal.desconto + proposal.frete;

  const emptyRows = Math.max(0, 10 - proposal.itens.length);

  return (
    <div className="print-area bg-card p-8 max-w-[210mm] mx-auto text-sm text-card-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="border-2 border-foreground p-4 flex gap-6 items-center mb-1">
        <img src={logo} alt="3D Usinagem" className="w-36 h-auto" />
        <div className="text-right flex-1">
          <h1 className="text-xl font-extrabold tracking-tight">3D USINAGEM E SOLUÇÕES INDUSTRIAIS</h1>
          <p className="font-semibold text-xs">CNPJ: 13.570.620/0001-08</p>
          <p className="text-xs text-muted-foreground">Servidão Horst Schulze nº68</p>
          <p className="text-xs text-muted-foreground">Bairro Jardim Sofia - JOINVILLE/SC</p>
          <p className="text-xs text-muted-foreground mt-1">contato@3dusinagem.com.br</p>
          <p className="text-xs text-muted-foreground">whatsapp (47) 99616-1212</p>
        </div>
      </div>

      {/* Proposal info row */}
      <div className="border-2 border-t-0 border-foreground grid grid-cols-3 text-center text-xs">
        <div className="p-2 border-r border-foreground">
          Orçamento nº: <span className="font-bold text-primary">{proposal.numero}</span>
        </div>
        <div className="p-2 border-r border-foreground">
          Emitido em: <span className="font-bold">{formatDate(proposal.emitidoEm)}</span>
        </div>
        <div className="p-2">
          Válido até: <span className="font-bold">{formatDate(proposal.validoAte)}</span>
        </div>
      </div>

      {/* Cliente */}
      <div className="mt-3 border-2 border-foreground">
        <div className="bg-foreground text-card text-center text-xs font-bold py-1">CLIENTE</div>
        <table className="w-full text-xs border-collapse">
          <tbody>
            <tr className="border-b border-foreground">
              <td className="font-bold p-1.5 border-r border-foreground w-20">NOME</td>
              <td className="p-1.5" colSpan={5}>{proposal.cliente.nome}</td>
            </tr>
            <tr className="border-b border-foreground">
              <td className="font-bold p-1.5 border-r border-foreground">TELEFONE</td>
              <td className="p-1.5 border-r border-foreground">{proposal.cliente.telefone}</td>
              <td className="font-bold p-1.5 border-r border-foreground w-16">EMAIL</td>
              <td className="p-1.5" colSpan={3}>{proposal.cliente.email}</td>
            </tr>
            <tr className="border-b border-foreground">
              <td className="font-bold p-1.5 border-r border-foreground">CPF/CNPJ</td>
              <td className="p-1.5 border-r border-foreground">{proposal.cliente.cpfCnpj}</td>
              <td className="font-bold p-1.5 border-r border-foreground">RG/IE</td>
              <td className="p-1.5" colSpan={3}>{proposal.cliente.rgIe}</td>
            </tr>
            <tr className="border-b border-foreground">
              <td className="font-bold p-1.5 border-r border-foreground">ENDEREÇO</td>
              <td className="p-1.5" colSpan={5}>{proposal.cliente.endereco}</td>
            </tr>
            <tr>
              <td className="font-bold p-1.5 border-r border-foreground">BAIRRO</td>
              <td className="p-1.5 border-r border-foreground">{proposal.cliente.bairro}</td>
              <td className="font-bold p-1.5 border-r border-foreground">CIDADE</td>
              <td className="p-1.5 border-r border-foreground">{proposal.cliente.cidade}</td>
              <td className="font-bold p-1.5 border-r border-foreground w-14">ESTADO</td>
              <td className="p-1.5 w-10">{proposal.cliente.estado}</td>
            </tr>
            <tr className="border-t border-foreground">
              <td className="font-bold p-1.5 border-r border-foreground">CEP</td>
              <td className="p-1.5" colSpan={5}>{proposal.cliente.cep}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Itens */}
      <div className="mt-3 border-2 border-foreground">
        <div className="bg-foreground text-card text-center text-xs font-bold py-1">ORÇAMENTO</div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-foreground font-bold">
              <th className="p-1.5 border-r border-foreground w-12 text-center">ITEM</th>
              <th className="p-1.5 border-r border-foreground text-left">PRODUTO/SERVIÇO</th>
              <th className="p-1.5 border-r border-foreground w-12 text-center">QTD</th>
              <th className="p-1.5 border-r border-foreground w-24 text-right">VALOR UNIT</th>
              <th className="p-1.5 w-24 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {proposal.itens.map((item, idx) => (
              <tr key={item.id} className="border-b border-foreground">
                <td className="p-1.5 border-r border-foreground text-center">{String(idx + 1).padStart(2, "0")}</td>
                <td className="p-1.5 border-r border-foreground">{item.produto}</td>
                <td className="p-1.5 border-r border-foreground text-center">{item.qtd}</td>
                <td className="p-1.5 border-r border-foreground text-right">{formatCurrency(item.valorUnit)}</td>
                <td className="p-1.5 text-right">{formatCurrency(item.qtd * item.valorUnit)}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`empty-${i}`} className="border-b border-foreground">
                <td className="p-1.5 border-r border-foreground">&nbsp;</td>
                <td className="p-1.5 border-r border-foreground">&nbsp;</td>
                <td className="p-1.5 border-r border-foreground">&nbsp;</td>
                <td className="p-1.5 border-r border-foreground">&nbsp;</td>
                <td className="p-1.5">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totais */}
      <div className="mt-1 grid grid-cols-4 text-xs text-center">
        <div>
          <div className="border border-foreground p-1 font-semibold">SUBTOTAL</div>
          <div className="border border-t-0 border-foreground p-1">{formatCurrency(subtotal)}</div>
        </div>
        <div>
          <div className="border border-l-0 border-foreground p-1 font-semibold">DESCONTO</div>
          <div className="border border-t-0 border-l-0 border-foreground p-1">{formatCurrency(proposal.desconto)}</div>
        </div>
        <div>
          <div className="border border-l-0 border-foreground p-1 font-semibold">FRETE</div>
          <div className="border border-t-0 border-l-0 border-foreground p-1">{formatCurrency(proposal.frete)}</div>
        </div>
        <div>
          <div className="border border-l-0 border-foreground p-1 font-bold">TOTAL</div>
          <div className="border border-t-0 border-l-0 border-foreground p-1 font-bold">{formatCurrency(total)}</div>
        </div>
      </div>

      {/* Observações */}
      <div className="mt-3 border-2 border-foreground">
        <div className="bg-foreground text-card text-center text-xs font-bold py-1">OBSERVAÇÕES</div>
        <div className="p-3 text-xs space-y-2 min-h-[80px]">
          <div>
            <span className="font-bold">FORMA DE PAGAMENTO</span>
            <p>{proposal.formaPagamento}</p>
          </div>
          <div>
            <span className="font-bold">FRETE</span>
            <p>{proposal.observacoesFrete}</p>
          </div>
          <div>
            <span className="font-bold">OUTRAS OBSERVAÇÕES</span>
            <p>{proposal.outrasObservacoes}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-between text-xs text-muted-foreground">
        <p>Criado em {formatDate(proposal.emitidoEm)}, por {proposal.criadoPor}</p>
        <p>Assinatura: ______________________________</p>
      </div>
    </div>
  );
};

export default ProposalPreview;
