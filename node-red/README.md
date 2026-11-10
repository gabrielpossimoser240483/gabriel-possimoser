# Node-RED: aba de teste do WhatsApp

`teste-whatsapp.json` cria uma aba separada, **Teste WhatsApp**, para testar o nó
[`whatsapp-neway-automacoes`](https://github.com/diegodamacenosantos/WHATSAPP_NEWAY_AUTOMACOES)
sem mexer nos outros fluxos.

## Antes de importar

O nó `whatsapp-neway-automacoes` precisa estar instalado (Gerenciar paleta → Instalar → enviar o `.tgz`)
e a conta já vinculada pelo QR code.

## Importar

1. Copie todo o conteúdo de `teste-whatsapp.json`.
2. No Node-RED: Menu → **Importar** → cole → **Importar**.
3. Dê duplo clique na aba **Teste WhatsApp** → em **Environment Variables** troque `MEU_NUMERO`
   pelo seu número com 55 e DDD, só dígitos (ex.: `5541999998888`).
4. Abra os dois nós WhatsApp da aba (envio e recebimento) e escolha a sua **Conta** já conectada.
   Não crie uma conta nova com o mesmo número: duas sessões do mesmo número derrubam uma à outra.
5. **Deploy**.

## Testes

| Teste | Como fazer | O que deve acontecer |
|---|---|---|
| 1 - Envio | clicar no botão do nó **Mandar teste para mim** | chega "✅ Teste do Node-RED funcionando" no seu WhatsApp |
| 2 - Recebimento | alguém te manda uma mensagem (ou você manda para o seu próprio número) | aparece na aba **Debug** |
| 3 - Comandos | mande `ping`, `hora` ou `ajuda` na conversa com o seu próprio número | o Node-RED responde com 🤖 |

Os comandos só respondem ao seu número e ignoram grupos. Respostas que não são comando não geram resposta,
então não entra em loop. O envio segue os limites do nó (5 a 15 s de espera entre mensagens), então a
resposta demora alguns segundos.

## Apagar o teste

Dê duplo clique na aba → **Excluir** → Deploy. Os outros fluxos e a conta não são afetados.
