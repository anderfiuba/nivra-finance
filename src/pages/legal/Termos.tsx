import LegalLayout from "./LegalLayout";

export default function Termos() {
  return (
    <LegalLayout title="Termos de Uso">
      <p>
        Bem-vindo à Nivra. Ao criar uma conta, você concorda com estes Termos. Leia com atenção.
      </p>

      <h2>1. Objeto</h2>
      <p>
        A Nivra fornece uma plataforma de visualização e organização de informações financeiras
        pessoais via Open Finance regulado pelo Banco Central. A plataforma opera em modo somente
        leitura — não inicia pagamentos, transferências ou aplicações.
      </p>

      <h2>2. Conta</h2>
      <ul>
        <li>Você deve ter 18 anos ou mais.</li>
        <li>Você é responsável por manter sua senha em sigilo.</li>
        <li>É proibido compartilhar a conta ou tentar acessar dados de terceiros.</li>
      </ul>

      <h2>3. Uso aceitável</h2>
      <p>
        Você concorda em não usar a plataforma para fins ilegais, automatizar acessos
        (scraping, bots) ou tentar burlar mecanismos de segurança.
      </p>

      <h2>4. Open Finance</h2>
      <p>
        A conexão com instituições financeiras ocorre exclusivamente pelo provedor regulado
        (Pluggy). Em nenhum momento solicitamos sua senha de internet banking. Você pode revogar
        o consentimento a qualquer momento na própria instituição financeira ou diretamente em
        Conexões na Nivra.
      </p>

      <h2>5. Disponibilidade</h2>
      <p>
        Buscamos manter a plataforma disponível 24/7, mas não garantimos disponibilidade
        ininterrupta. Manutenções, falhas em provedores externos (Open Finance, hospedagem) ou
        incidentes de segurança podem causar indisponibilidade temporária.
      </p>

      <h2>6. Limitação de responsabilidade</h2>
      <p>
        As informações exibidas são derivadas de dados transmitidos por terceiros (instituições
        financeiras via Open Finance). Embora nos esforcemos pela exatidão, decisões financeiras
        são de sua responsabilidade exclusiva. A Nivra não substitui assessoria financeira ou
        contábil profissional.
      </p>

      <h2>7. Privacidade e LGPD</h2>
      <p>
        O tratamento de dados pessoais é regido pela{" "}
        <a href="/privacidade">Política de Privacidade</a>, parte integrante destes Termos.
      </p>

      <h2>8. Encerramento</h2>
      <p>
        Você pode encerrar sua conta a qualquer momento via Configurações → Privacidade. Podemos
        suspender contas que violem estes Termos.
      </p>

      <h2>9. Foro</h2>
      <p>
        Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro da comarca do
        controlador dos dados, com renúncia a qualquer outro.
      </p>
    </LegalLayout>
  );
}