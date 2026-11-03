# Tuk Manager

Aplicação para as contas de um negócio com vários tuks e vários motoristas. Corre no telemóvel, em português da Europa. Não há servidor: ou ficas no modo demonstração (os dados ficam neste aparelho) ou entras com Google e a folha do ano fica na tua Drive.

Endereço público, depois de estar na branch `main`: [https://702nuno-netizen.github.io/tuk-manager/](https://702nuno-netizen.github.io/tuk-manager/).

## Começar

1. Abre a app.
2. **Experimentar com dados de demonstração** mostra um negócio de exemplo, sem conta. No modo demonstração o «hoje» é 2 de novembro de 2026, para corresponder aos ecrãs aprovados.
3. **Entrar com Google** pede só o âmbito `drive.file` (a app só vê ficheiros que ela própria cria). No primeiro passo indicas o nome do negócio, o primeiro tuk e o primeiro motorista. A app cria a folha «Nome · ano».

O nome **Tuk Manager** só aparece no ecrã inicial. A partir daí o topo mostra o nome do negócio, que se muda em Definições.

## O que a app faz

- **Hoje, Mês, Ano, Objetivos.** Definições ficam na engrenagem.
- Quem usa é o patrão: lança o dia de todos os motoristas. Não há entrada de motorista.
- Um tuk por motorista por dia. Escolher um tuk ocupado troca logo; o outro fica sem tuk.
- Sem tuk não se lançam serviços nem gastos.
- A percentagem é sempre a parte do motorista (55% quer dizer que ele fica com 55% e o patrão com 45%) e muda a partir de uma data.
- O patrão não tem percentagem, entregas, saldo nem prémio. As gratificações são só dele, não entram no faturado, e podem esconder-se.
- Gastos de fábrica: Combustível (diário, só combustão), Outros (diário), Garagem (mensal, repete a partir do dia 1 quando o mês chega), Manutenção (mensal, soma, mesmo com o tuk parado). Dá para criar, mudar e apagar tipos.
- Objetivo igual para todos os motoristas. O objetivo da empresa é esse valor vezes quem trabalhou pelo menos um dia, patrão incluído. O prémio é igual para quem cumpre; o patrão aparece como cumprido e não recebe.
- Alterações sem rede ficam numa fila neste aparelho e sobem quando a ligação volta.

## A folha

Uma folha Google por ano, no desenho v4: separadores visíveis (Painel, Motoristas, Tuks, Gastos, um por motorista, um por tuk, Ajuda) e separadores ocultos com ⚙. A coluna A e a linha 1, ocultas, são as chaves. A app lê e escreve por essas chaves. Antes de gravar, relê a célula: se alguém a mudou à mão, fica o valor da folha.

As fórmulas vão para a API com separador `;`. Só se escreve em células de entrada. Motorista inativo e tuk vendido deixam de aparecer no dia e não se apagam. Um tipo de gasto diário novo entra numa coluna antes da coluna oculta `fim`. Um tipo mensal usa as linhas livres `M|ano-mês|-`.

**Repor aspeto da folha** refaz larguras, fórmulas, colunas ocultas e proteções. Se um separador foi apagado, a app pergunta antes de o criar. Criar outro ano faz uma folha nova, com os mesmos tuks, motoristas e o saldo transitado.

Ficheiros marcados na Drive com `tmApp=tuk-manager`, `role` `main` ou `backup`, e `year`.

## Ficheiros

Não há passo de compilação. São módulos ES, CSS e um manifesto. O Chart.js está em `vendor/`. O identificador OAuth está em `config.js` (é público; não é um segredo).

Privacidade: [privacy.html](privacy.html). Termos: [terms.html](terms.html).
