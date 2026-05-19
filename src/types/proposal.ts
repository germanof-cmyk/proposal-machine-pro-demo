export interface ProposalItem {
  id: string;
  produto: string;
  qtd: number;
  valorUnit: number;
}

export interface ProposalClient {
  nome: string;
  telefone: string;
  email: string;
  cpfCnpj: string;
  rgIe: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface Proposal {
  id: string;
  numero: string;
  emitidoEm: string;
  validoAte: string;
  cliente: ProposalClient;
  itens: ProposalItem[];
  desconto: number;
  frete: number;
  formaPagamento: string;
  observacoesFrete: string;
  outrasObservacoes: string;
  criadoPor: string;
  status: "aberta" | "fechada";
  valorFechado: number;
}
