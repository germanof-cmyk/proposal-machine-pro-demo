import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const {
      tipo = 'etapa_concluida',
      orcamento_id,
      processo_id,
      etapa_nome,
      orcamento_numero,
      empresa_nome,
      company_id,
      proxima_etapa,
      numero_pc,
      numero_nf,
      finalizado_em,
    } = body

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: config } = await supabase
      .from('alertas_config')
      .select('*')
      .eq('company_id', company_id)
      .single()

    const { data: empresaConfig } = await supabase
      .from('empresa_config')
      .select('*')
      .limit(1)
      .single()

    const { data: empresa } = await supabase
      .from('client_companies')
      .select('portal_token')
      .eq('id', company_id)
      .single()

    const portalToken = empresa?.portal_token
    const portalLink = portalToken
      ? `https://centralpropostas.vercel.app/pedidos/${portalToken}`
      : 'https://centralpropostas.vercel.app/portal'

    const resultados: Array<{ canal: string; destinatario: string; sucesso: boolean; data: unknown }> = []

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    // ── Build email content based on tipo ─────────────────────────────────────

    let emailSubject = ''
    let emailHtml = ''

    const dataHoraFinalizado = finalizado_em
      ? new Date(finalizado_em).toLocaleString('pt-BR')
      : new Date().toLocaleString('pt-BR')

    if (tipo === 'orcamento_finalizado') {
      emailSubject = `📦 Pedido ${orcamento_numero} finalizado — aguardando embarque`
      emailHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9f9f8;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f8;padding:32px 0">
  <tr>
    <td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #eee;overflow:hidden">

        <!-- CABEÇALHO -->
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px 12px 0 0">
              <tr>
                <td style="padding:18px 24px">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#fff;border-radius:6px;width:34px;height:34px;text-align:center;vertical-align:middle;font-weight:700;font-size:11px;color:#111">
                        3D
                      </td>
                      <td style="padding-left:12px">
                        <div style="color:#fff;font-weight:600;font-size:14px;line-height:1.2">${empresaConfig?.nome || '3D Usinagem'}</div>
                        <div style="color:rgba(255,255,255,0.45);font-size:11px;line-height:1.4">Portal de Fabricação</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CORPO -->
        <tr>
          <td style="padding:28px 24px">

            <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:6px">Pedido finalizado</div>
            <p style="font-size:13px;color:#888;margin:0 0 24px;line-height:1.6">
              Sua produção foi concluída e o pedido está aguardando embarque na transportadora.
            </p>

            <!-- TABELA DE DETALHES -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f8;border-radius:10px;border:1px solid #eee;margin-bottom:24px">
              <tr>
                <td style="padding:18px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr style="border-bottom:1px solid #f0f0f0">
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Orçamento</td>
                      <td style="font-size:13px;font-weight:600;color:#111;text-align:right;padding:8px 0">${orcamento_numero}</td>
                    </tr>
                    ${numero_pc ? `
                    <tr style="border-bottom:1px solid #f0f0f0">
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Pedido de compra</td>
                      <td style="font-size:13px;font-weight:600;color:#111;text-align:right;padding:8px 0">PC · ${numero_pc}</td>
                    </tr>` : ''}
                    <tr style="border-bottom:1px solid #f0f0f0">
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Empresa</td>
                      <td style="font-size:13px;font-weight:600;color:#111;text-align:right;padding:8px 0">${empresa_nome}</td>
                    </tr>
                    ${numero_nf ? `
                    <tr style="border-bottom:1px solid #f0f0f0">
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Nota fiscal (NF)</td>
                      <td style="font-size:13px;font-weight:600;color:#111;text-align:right;padding:8px 0">${numero_nf}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Finalizado em</td>
                      <td style="font-size:12px;color:#333;text-align:right;padding:8px 0">${dataHoraFinalizado}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- STATUS BADGE -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:8px;margin-bottom:24px">
              <tr>
                <td style="padding:12px 16px">
                  <div style="font-size:12px;font-weight:600;color:#1d4ed8;margin-bottom:2px">📦 Aguardando embarque</div>
                  <div style="font-size:12px;color:#1d4ed8">O pedido foi finalizado e está aguardando retirada ou entrega pela transportadora.</div>
                </td>
              </tr>
            </table>

            <!-- BOTÃO -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px">
                  <a href="${portalLink}"
                     style="display:inline-block;background:#111;color:#fff;font-size:13px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none">
                    Acompanhar pedido &#8594;
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- RODAPÉ -->
        <tr>
          <td style="padding:16px 24px;border-top:1px solid #f0f0f0;text-align:center">
            <p style="font-size:11px;color:#bbb;margin:0">
              ${empresaConfig?.razao_social || '3D Usinagem e Soluções Industriais'} &middot;
              CNPJ ${empresaConfig?.cnpj || ''} &middot;
              ${empresaConfig?.cidade || 'Joinville'} ${empresaConfig?.estado || 'SC'}
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
`
    } else {
      // etapa_concluida (default)
      emailSubject = `✅ Etapa concluída — ${orcamento_numero}`
      emailHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9f9f8;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f8;padding:32px 0">
  <tr>
    <td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #eee;overflow:hidden">

        <!-- CABEÇALHO -->
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px 12px 0 0">
              <tr>
                <td style="padding:18px 24px">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#fff;border-radius:6px;width:34px;height:34px;text-align:center;vertical-align:middle;font-weight:700;font-size:11px;color:#111">
                        3D
                      </td>
                      <td style="padding-left:12px">
                        <div style="color:#fff;font-weight:600;font-size:14px;line-height:1.2">${empresaConfig?.nome || '3D Usinagem'}</div>
                        <div style="color:rgba(255,255,255,0.45);font-size:11px;line-height:1.4">Portal de Fabricação</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CORPO -->
        <tr>
          <td style="padding:28px 24px">

            <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:6px">Etapa concluída</div>
            <p style="font-size:13px;color:#888;margin:0 0 24px;line-height:1.6">
              Uma etapa do cronograma de produção foi marcada como concluída pelo fabricante.
            </p>

            <!-- TABELA DE DETALHES -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f8;border-radius:10px;border:1px solid #eee;margin-bottom:24px">
              <tr>
                <td style="padding:18px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr style="border-bottom:1px solid #f0f0f0">
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Orçamento</td>
                      <td style="font-size:13px;font-weight:600;color:#111;text-align:right;padding:8px 0">${orcamento_numero}</td>
                    </tr>
                    ${numero_pc ? `
                    <tr style="border-bottom:1px solid #f0f0f0">
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Pedido de compra</td>
                      <td style="font-size:13px;font-weight:600;color:#111;text-align:right;padding:8px 0">PC · ${numero_pc}</td>
                    </tr>` : ''}
                    <tr style="border-bottom:1px solid #f0f0f0">
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Empresa</td>
                      <td style="font-size:13px;font-weight:600;color:#111;text-align:right;padding:8px 0">${empresa_nome}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f0f0f0">
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Etapa concluída</td>
                      <td style="text-align:right;padding:8px 0">
                        <span style="background:#f0fdf4;color:#166534;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px">
                          &#10003; ${etapa_nome}
                        </span>
                      </td>
                    </tr>
                    ${proxima_etapa ? `
                    <tr style="border-bottom:1px solid #f0f0f0">
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Próxima etapa</td>
                      <td style="font-size:12px;color:#111;text-align:right;padding:8px 0">${proxima_etapa}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="font-size:12px;color:#aaa;padding:8px 0">Data e hora</td>
                      <td style="font-size:12px;color:#333;text-align:right;padding:8px 0">${new Date().toLocaleString('pt-BR')}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${proxima_etapa ? `
            <!-- PRÓXIMA ETAPA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:8px;margin-bottom:24px">
              <tr>
                <td style="padding:12px 16px">
                  <div style="font-size:12px;font-weight:600;color:#1d4ed8;margin-bottom:2px">Próxima etapa</div>
                  <div style="font-size:12px;color:#1d4ed8">${proxima_etapa}</div>
                </td>
              </tr>
            </table>` : ''}

            <!-- BOTÃO -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px">
                  <a href="${portalLink}"
                     style="display:inline-block;background:#111;color:#fff;font-size:13px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none">
                    Ver orçamento completo &#8594;
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- RODAPÉ -->
        <tr>
          <td style="padding:16px 24px;border-top:1px solid #f0f0f0;text-align:center">
            <p style="font-size:11px;color:#bbb;margin:0">
              ${empresaConfig?.razao_social || '3D Usinagem e Soluções Industriais'} &middot;
              CNPJ ${empresaConfig?.cnpj || ''} &middot;
              ${empresaConfig?.cidade || 'Joinville'} ${empresaConfig?.estado || 'SC'}
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
`
    }

    // ── E-MAIL via Resend ──────────────────────────────────────────────────────
    if (RESEND_API_KEY) {
      const destinatarios: string[] = []
      if (config?.email_representante) destinatarios.push(config.email_representante)
      if (config?.email_cliente) destinatarios.push(config.email_cliente)

      for (const email of destinatarios) {
        const emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${empresaConfig?.nome ?? '3D Usinagem'} <onboarding@resend.dev>`,
            to: [email],
            subject: emailSubject,
            html: emailHtml,
          }),
        })

        const emailData = await emailResp.json()
        resultados.push({ canal: 'email', destinatario: email, sucesso: emailResp.ok, data: emailData })

        await supabase.from('alertas_log').insert({
          orcamento_id,
          processo_id: processo_id ?? null,
          tipo,
          destinatario: email,
          canal: 'email',
        })
      }
    }

    // ── WHATSAPP via Evolution API ─────────────────────────────────────────────
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
    const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE')

    if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE) {
      const whatsapps: string[] = []
      if (config?.whatsapp_representante) whatsapps.push(config.whatsapp_representante)
      if (config?.whatsapp_cliente) whatsapps.push(config.whatsapp_cliente)

      let mensagem = ''
      if (tipo === 'orcamento_finalizado') {
        mensagem =
          `📦 *Pedido finalizado — ${orcamento_numero}*\n\n` +
          `*Empresa:* ${empresa_nome}\n` +
          (numero_pc ? `*PC:* ${numero_pc}\n` : '') +
          (numero_nf ? `*NF:* ${numero_nf}\n` : '') +
          `*Finalizado em:* ${dataHoraFinalizado}\n\n` +
          `O pedido está aguardando embarque na transportadora.\n\n` +
          `_${empresaConfig?.nome ?? '3D Usinagem'} · Portal de Fabricação_`
      } else {
        mensagem =
          `✅ *Etapa concluída — ${orcamento_numero}*\n\n` +
          `*Empresa:* ${empresa_nome}\n` +
          `*Etapa:* ${etapa_nome}\n` +
          `*Data/hora:* ${new Date().toLocaleString('pt-BR')}\n\n` +
          `_${empresaConfig?.nome ?? '3D Usinagem'} · Portal de Fabricação_`
      }

      for (const numero of whatsapps) {
        const waResp = await fetch(
          `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
          {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: numero.replace(/\D/g, ''),
              text: mensagem,
            }),
          }
        )

        const waData = await waResp.json()
        resultados.push({ canal: 'whatsapp', destinatario: numero, sucesso: waResp.ok, data: waData })

        await supabase.from('alertas_log').insert({
          orcamento_id,
          processo_id: processo_id ?? null,
          tipo,
          destinatario: numero,
          canal: 'whatsapp',
        })
      }
    }

    return new Response(
      JSON.stringify({ ok: true, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
