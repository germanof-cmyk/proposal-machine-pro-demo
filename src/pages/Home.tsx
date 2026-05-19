import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlignJustify, FileText, User, ArrowRight, X } from "lucide-react";
import logo from "@/assets/logo-frotaly.png";

export default function Home() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const cards = [
    {
      icon: <AlignJustify className="w-5 h-5" style={{ color: "#2563eb" }} />,
      iconBg: "#eff6ff",
      title: "Portal Comercial",
      description:
        "Gestão de propostas, orçamentos, comissões e cronogramas. Acesso do representante.",
      tag: undefined,
      tagBg: undefined,
      tagColor: undefined,
      borderHover: "#2563eb",
      onClick: () => navigate("/login"),
    },
    {
      icon: <FileText className="w-5 h-5" style={{ color: "#16a34a" }} />,
      iconBg: "#f0fdf4",
      title: "Portal de Fabricação",
      description:
        "Acompanhamento e gestão do cronograma de produção, pedidos e documentos.",
      tag: "Fabricante",
      tagBg: "#f0fdf4",
      tagColor: "#166534",
      borderHover: "#16a34a",
      onClick: () => navigate("/portal/login"),
    },
    {
      icon: <User className="w-5 h-5" style={{ color: "#7c3aed" }} />,
      iconBg: "#fdf4ff",
      title: "Portal do Cliente Final",
      description:
        "Visualização de pedidos e status de entrega. Acesso via link exclusivo.",
      tag: "Link exclusivo",
      tagBg: "#fdf4ff",
      tagColor: "#6d28d9",
      borderHover: "#7c3aed",
      onClick: () => setModalOpen(true),
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#f9f9f8" }}
    >
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img src={logo} alt="Frotaly" style={{ height: 40, width: "auto" }} />
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" }}>
            Frotaly
          </span>
        </div>
        <p style={{ fontSize: 15, color: "#888", margin: 0 }}>
          Selecione o módulo de acesso
        </p>
      </div>

      {/* Cards grid */}
      <div
        className="grid gap-4 w-full"
        style={{ maxWidth: 720, gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        {cards.map((card) => (
          <ModuleCard key={card.title} {...card} />
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-7 max-w-sm w-full relative"
            style={{ border: "0.5px solid #e5e5e5" }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl mb-4"
              style={{ background: "#fdf4ff" }}
            >
              <User className="w-5 h-5" style={{ color: "#7c3aed" }} />
            </div>

            <h2 className="text-[16px] font-semibold mb-2">Portal do Cliente Final</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
              O acesso ao Portal do Cliente Final é feito via link exclusivo enviado
              pela Frotaly. Entre em contato para solicitar o seu link.
            </p>
            <button
              onClick={() => setModalOpen(false)}
              className="w-full text-[13px] font-medium py-2.5 rounded-xl transition-colors"
              style={{ background: "#111", color: "#fff" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#333")}
              onMouseLeave={e => (e.currentTarget.style.background = "#111")}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ModuleCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  tag?: string;
  tagBg?: string;
  tagColor?: string;
  borderHover: string;
  onClick: () => void;
}

function ModuleCard({ icon, iconBg, title, description, tag, tagBg, tagColor, borderHover, onClick }: ModuleCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-left flex flex-col"
      style={{
        background: "#fff",
        border: `0.5px solid ${hovered ? borderHover : "#e5e5e5"}`,
        borderRadius: 16,
        padding: "28px 24px",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "border-color 0.15s, transform 0.15s",
        cursor: "pointer",
      }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center w-10 h-10 rounded-xl mb-5"
        style={{ background: iconBg }}
      >
        {icon}
      </div>

      {/* Title */}
      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#111" }}>
        {title}
      </p>

      {/* Description */}
      <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6, flex: 1, marginBottom: 16 }}>
        {description}
      </p>

      {/* Footer: tag + arrow */}
      <div className="flex items-center justify-between mt-auto">
        {tag ? (
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: tagBg, color: tagColor }}
          >
            {tag}
          </span>
        ) : <span />}
        <ArrowRight
          className="w-4 h-4 transition-transform"
          style={{ color: borderHover, transform: hovered ? "translateX(3px)" : "translateX(0)", transition: "transform 0.15s" }}
        />
      </div>
    </button>
  );
}
