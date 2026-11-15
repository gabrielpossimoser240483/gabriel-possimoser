# Casa: registro da automação (Tuya + Node-RED)

Caderno do que foi feito na casa pelo Claude, para continuar depois sem perder nada.
Última atualização: 15/11/2026.

> **Segredos não ficam aqui.** As chaves da Tuya, a senha do Node-RED e o token do Pushover
> **não** estão neste repositório. As chaves da Tuya e do Pushover já estão gravadas dentro dos
> blocos do Node-RED no servidor, e também na aba **Overview** do projeto na Tuya.

---

## Como reconectar (para pedir coisas novas ao Claude)

O Claude roda fora de casa e só alcança o Node-RED (`10.0.0.104:1880`) por um **túnel temporário**.

1. No computador, abra o **Terminal** e entre no servidor: `ssh gabriel@10.0.0.104`
2. Rode o túnel (o arquivo já foi baixado antes; se não existir, a primeira parte baixa de novo):
   ```
   [ -x /tmp/cf ] || (curl -L -o /tmp/cf https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x /tmp/cf); /tmp/cf tunnel --url http://localhost:1880
   ```
3. Mande para o Claude o endereço `https://....trycloudflare.com` que aparecer (cada vez é um novo).
4. Mande também o **usuário e a senha do Node-RED** (usuário: `gabriel`).
5. Quando terminar, aperte **Ctrl+C** na janela do túnel.

Para o Claude: o ambiente de nuvem **"Casa Tuya"** já libera `openapi.tuyaus.com`. Cada endereço
novo do túnel precisa ser liberado de novo no ambiente (é um host diferente a cada vez).
Login no Node-RED: `POST /auth/token` (client_id `node-red-admin`, grant_type `password`, scope `*`).
Deploy: `POST /flows` com `Node-RED-API-Version: v2` e `Node-RED-Deployment-Type: nodes`.

---

## Tuya

- Site: https://us.platform.tuya.com, data center **Western America** (API: `openapi.tuyaus.com`).
- Projeto em uso: **"Home Assistant"** (a conta do Smart Life está ligada nele, 8+ aparelhos).
  O projeto "gabriel" existe mas **não** tem aparelhos (a conta Smart Life atingiu o limite de 2 projetos).
- Serviços ativos: **IoT Core** (trial renovado, vence **15/05/2027**: renovar em
  Cloud → Cloud Services → IoT Core → *Extend Trial Period*), **Smart Lock Open Service** (desde 15/11/2026).
- Assinatura das chamadas: HMAC-SHA256; parâmetros da URL em **ordem alfabética** (senão dá "sign invalid").

### Aparelhos

| Nome (Tuya / Smart Life) | ID | Tipo |
|---|---|---|
| Luz Dimmer Corredor 1 (era "Dimmer", apelido "Jimmy") | `eb947f00c7f9b3fcafb9qv` | lâmpada (brilho + quente/frio) |
| Luz Dimmer Corredor 2 (era "Sport-Wi-Fi") | `eb0647e9014595c5703fgv` | lâmpada (brilho + quente/frio) |
| EKAZA Fechadura Digital Zigbee | `ebc777d960783fb572mjea` | fechadura (via Smart Gateway) |
| Smart Gateway | — | gateway Zigbee da Tuya |
| Bombas (EKAZA Interruptor Touch 2 Botão) | — | interruptor |
| RGB TESTE | `eb59af9ff60d7c7abcfgfj` | lâmpada (offline) |

Lâmpadas: `bright_value_v2` 10–1000, `temp_value_v2` 0 (quente) a 1000 (frio).
Fechadura: abertura remota **sem senha** está permitida na fechadura (`remoteUnlockWithoutPwd`).

---

## Node-RED (servidor Debian `10.0.0.104`, Node-RED 5.0.9, Dashboard 2.0)

O Node-RED não tinha ligação com a Tuya: tudo é feito por blocos *function* que chamam a nuvem
da Tuya (módulos `crypto` e `https`). Código de referência em [`node-red/`](node-red/).

### Página **Corredor&Banheiro** (aba "Corredor e Banheiro")

- **Luz Dimmer Corredor 1** e **2**: liga/desliga, brilho, quente/frio. Lê o estado a cada 30 s.
  Blocos: prefixo `jimmy…` (lâmpada 1) e `dimc2…` (lâmpada 2).
- **Automação Luz Dimmer Corredor 1** e **2**: sensor de presença do **corredor**
  (`zigbee2mqtt/corredor_presenca_24g`). Quando alguém entra e está escuro (< 80 lux):
  - 22h às 6h: quente, 20%
  - 6h às 22h: frio, 100%
  - Apaga quando o corredor fica vazio (só se foi a automação que acendeu).
  - Ajustes (liga/desliga, brilho e quente/frio de noite e de dia) ficam no dashboard e são
    salvos em `~/.node-red/jimmy_automacao.json` e `~/.node-red/dimmer_corredor2_automacao.json`.
- **Luz antiga do corredor** (interruptor Zigbee `corredor_interruptor_luzes`, tecla L2):
  - A automação pelo sensor foi **desativada** (bloco *link out* "→ corredor L2", id `4614135e9de04f82`).
  - Bloco **"mantém luz do corredor (L2) sempre ligada"** (`corl2guardfn1`): religa a L2 em 2 s se
    ela desligar, porque ela alimenta as lâmpadas dimmer. Desligar pelo botão ou parede não funciona mais (de propósito).

### Página **Sala** (aba "Sala")

- Cartão **Fechadura** (blocos `fech…`): porta aberta/fechada, bateria, trava interna, últimos eventos,
  botão **ABRIR A PORTA** (com confirmação), chave de avisos, trava interna, som da campainha.
- Lê a fechadura a cada 5 s (`/v2.0/cloud/thing/{id}/shadow/properties`, detecta eventos pela hora de cada dado).
- Avisos no **Pushover** (mesmo envio dos portões): abertura (digital/senha/cartão + nº do usuário),
  campainha, alarmes (digital/senha errada, arrombamento, impacto...), coação, bateria ≤ 20%.
- Abrir: `POST /v1.0/devices/{id}/door-lock/password-ticket` e depois
  `POST /v1.0/smart-lock/devices/{id}/password-free/door-operate` (`{ticket_id, open: true}`).
- O histórico fica na memória (zera se o Node-RED reiniciar).

---

## Pendências

- [ ] Confirmar que o botão **ABRIR A PORTA** destranca de verdade (ainda não testado em 15/11).
- [ ] Confirmar que os avisos da fechadura chegam no celular.
- [ ] Confirmar as duas lâmpadas acendendo pelo sensor do corredor.
- [ ] Trocar a senha do Node-RED (ela foi escrita no chat em 15/11/2026).
- [ ] Melhorar o visual do cartão da fechadura (pedido em 15/11/2026).
- [ ] Dar nome às pessoas da fechadura (usuário 1, 2... → nomes).
- [ ] Pedido antigo, ainda não feito: no **quarto**, primeiro clique do botão da fechadura liga o ventilador.
