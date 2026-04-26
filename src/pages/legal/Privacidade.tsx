import LegalLayout from "./LegalLayout";

export default function Privacidade() {
  return (
    <LegalLayout title="Política de Privacidade">
      <p>
        A Nivra ("nós") respeita sua privacidade e trata seus dados pessoais em conformidade com a
        Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). Esta política descreve quais
        dados coletamos, com qual finalidade, por quanto tempo retemos e como você pode exercer
        seus direitos.
      </p>

      <h2>1. Quem somos</h2>
      <p>
        Nivra é uma plataforma de inteligência financeira pessoal que utiliza Open Finance regulado
        pelo Banco Central para centralizar, classificar e analisar suas movimentações bancárias em
        modo somente leitura. <em>Controlador dos dados:</em> [Razão social a preencher] —
        contato do Encarregado (DPO): <a href="mailto:dpo@nivra.app">dpo@nivra.app</a>.
      </p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li><strong>Identificação:</strong> nome, e-mail, senha (armazenada com hash bcrypt — nunca em texto puro).</li>
        <li><strong>Dados financeiros via Open Finance:</strong> contas, saldos, faturas e extratos transmitidos pela Pluggy mediante seu consentimento expresso na instituição.</li>
        <li><strong>Configurações de uso:</strong> ciclo financeiro, orçamentos por categoria.</li>
        <li><strong>Auditoria técnica:</strong> data e tipo dos eventos relevantes (login, exportação, exclusão de conta, sincronização) e endereço IP — usados exclusivamente para segurança e prestação de contas.</li>
      </ul>
      <p>
        <strong>Não coletamos credenciais bancárias.</strong> A autenticação ocorre integralmente
        no fluxo regulado da Pluggy/instituição financeira.
      </p>

      <h2>3. Bases legais (LGPD Art. 7º)</h2>
      <ul>
        <li>Consentimento — coleta de dados financeiros via Open Finance.</li>
        <li>Execução de contrato — operação da plataforma e funcionalidades contratadas.</li>
        <li>Cumprimento de obrigação legal/regulatória — quando aplicável (ex.: requisições judiciais).</li>
        <li>Legítimo interesse — segurança da informação, prevenção a fraude e auditoria.</li>
      </ul>

      <h2>4. Como usamos seus dados</h2>
      <ul>
        <li>Exibir extratos consolidados, orçamentos e indicadores.</li>
        <li>Categorizar transações automaticamente.</li>
        <li>Enviar alertas e insights sobre seu próprio dinheiro.</li>
      </ul>
      <p>
        <strong>Não vendemos, não alugamos e não compartilhamos seus dados</strong> com terceiros
        para fins comerciais.
      </p>

      <h2>5. Modo somente leitura</h2>
      <p>
        A Nivra opera tecnicamente como AISP (Account Information Service Provider): apenas
        consulta de informações, sem qualquer capacidade de iniciar pagamentos, PIX, TED ou outras
        movimentações financeiras nas suas contas.
      </p>

      <h2>6. Sub-processadores</h2>
      <ul>
        <li><strong>Pluggy</strong> — provedor de Open Finance regulado.</li>
        <li><strong>Supabase</strong> — banco de dados, autenticação e funções serverless.</li>
        <li><strong>Lovable</strong> — hospedagem do frontend.</li>
      </ul>
      <p>
        Hoje a infraestrutura de dados está hospedada em região fora do Brasil
        (transferência internacional autorizada pela LGPD Art. 33). Estamos avaliando migração
        para região no Brasil. Sempre que houver mudança, esta política será atualizada.
      </p>

      <h2>7. Segurança</h2>
      <ul>
        <li>Criptografia em trânsito (TLS 1.2+) em todas as comunicações.</li>
        <li>Criptografia em repouso (AES-256) no banco de dados e backups.</li>
        <li>Row Level Security garantindo isolamento entre usuários.</li>
        <li>Verificação de senhas contra bases públicas de vazamentos (HIBP).</li>
        <li>Trilha de auditoria imutável de eventos sensíveis.</li>
      </ul>

      <h2>8. Retenção</h2>
      <ul>
        <li>Transações: até 24 meses após a data da operação (limpeza automática semanal).</li>
        <li>Conexões com erro persistente: removidas após 90 dias de inatividade.</li>
        <li>Conta excluída: dados apagados imediatamente; consentimentos revogados na fonte.</li>
      </ul>

      <h2>9. Seus direitos (LGPD Art. 18)</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li>Acessar e corrigir seus dados via Configurações.</li>
        <li><strong>Exportar</strong> tudo o que armazenamos (formato JSON) — Configurações → Privacidade.</li>
        <li><strong>Excluir sua conta</strong> e revogar consentimentos — Configurações → Privacidade.</li>
        <li>Falar com nosso DPO: <a href="mailto:dpo@nivra.app">dpo@nivra.app</a>.</li>
      </ul>

      <h2>10. Cookies e rastreamento</h2>
      <p>
        Utilizamos apenas armazenamento local técnico para manter sua sessão. Não usamos cookies
        de rastreamento publicitário nem ferramentas de analytics de terceiros.
      </p>

      <h2>11. Mudanças nesta política</h2>
      <p>
        Alterações relevantes serão comunicadas por e-mail ou no produto. Revise periodicamente.
      </p>
    </LegalLayout>
  );
}