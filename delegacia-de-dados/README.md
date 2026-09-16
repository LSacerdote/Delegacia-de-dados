# Delegacia de Dados

Jogo de investigação criminal para aprender SQL. Dez casos, do `SELECT` simples às funções de janela, com um banco SQLite de verdade rodando dentro do navegador e sintaxe do BigQuery.

Site estático puro — sem build, sem backend, sem variáveis de ambiente.

```
index.html          o jogo inteiro (HTML + CSS + JS + os 10 bancos)
vendor/sql-asm.js   motor SQLite compilado para JavaScript (sql.js 1.14.2)
assets/audio/       os MP3 da narração (vazio até você gerar)
narrar.mjs          script que grava a narração
narracao.json       os textos a narrar, um por arquivo
vercel.json         cabeçalhos de cache
```

---

## Publicar no Vercel

Três caminhos. O primeiro é o mais rápido; o terceiro é o melhor se você for mexer no jogo depois.

### 1. Arrastar e soltar (1 minuto, sem instalar nada)

1. Abra <https://vercel.com/new>
2. Procure a opção de subir arquivos direto (*deploy without Git* / arrastar pasta)
3. Arraste **a pasta inteira** `delegacia-de-dados` — não só o `index.html`, senão o `vendor/` fica de fora
4. Clique em **Deploy**

### 2. Pela linha de comando

Dentro desta pasta:

```bash
npx vercel@latest login     # só na primeira vez
npx vercel@latest --prod
```

Framework **Other**, sem build command, output directory vazio.

### 3. Via GitHub (recomendado se for editar depois)

```bash
git init
git add .
git commit -m "Delegacia de Dados"
git branch -M main
git remote add origin git@github.com:SEU-USUARIO/delegacia-de-dados.git
git push -u origin main
```

Depois, em <https://vercel.com/new>, importe o repositório. Framework Preset: **Other**. Build Command e Output Directory vazios. A partir daí, cada `git push` publica sozinho.

---

## A narração

O jogo narra o briefing, os enunciados e o desfecho. Há dois modos, e ele escolhe sozinho.

### Modo 1 — voz do navegador (não precisa fazer nada)

Funciona de cara. O jogo procura a melhor voz em português instalada no aparelho e põe as boas no topo da lista, no botão **VOZ** do canto superior.

A diferença entre soar como narrador e soar como robô é **qual voz o sistema tem**:

| Onde | O que fazer | Resultado |
|---|---|---|
| **Microsoft Edge** | nada | Já traz as vozes *Online (Natural)* da Microsoft — Francisca, Antonio, Thalita. São neurais e gratuitas. **É o jeito mais rápido de ter voz boa.** |
| **Windows + Chrome** | Configurações → Hora e idioma → Fala → adicionar Português (Brasil) | Instala as vozes naturais e o Chrome passa a listá-las |
| **Mac / iPhone** | Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Português (Brasil) → baixar **Luciana (Aprimorada)** | Voz neural da Apple |
| **Android** | já vem com as vozes neurais do Google | Boa por padrão |
| **Linux** | normalmente só tem `espeak` | Robótica — use o modo 2 abaixo, ou abra no Edge |

Se você ouviu uma voz metálica, era o `espeak` ou uma voz antiga do sistema. Abra o painel **VOZ** e veja se aparece alguma com *Natural*, *Neural* ou *online* no nome — essas ficam sempre no começo da lista.

### Modo 2 — gravar os MP3 (grátis, sem conta)

Grava a narração em arquivo, com voz neural, e o jogo passa a tocar o arquivo em vez de sintetizar na hora. Fica igual para todo mundo que abrir o site, em qualquer navegador e sistema — inclusive Linux.

Usa o **edge-tts**, que fala com o mesmo serviço neural da Microsoft usado pelo Edge. Sem conta, sem chave de API, sem limite, sem custo.

```bash
pip install edge-tts          # uma vez só

node narrar.mjs --listar      # vê as vozes em português
node narrar.mjs               # grava os 20 arquivos principais
node narrar.mjs --pistas      # grava também os 50 enunciados
```

Precisa de Node 18 ou mais novo e Python com pip. Se o pip reclamar de "externally managed environment", use `pip install --user edge-tts` ou `pipx install edge-tts`.

A voz padrão é **pt-BR-AntonioNeural**, grave, com ritmo 8% mais lento e tom 12 Hz mais baixo — proposital, é o tom de narrador de caso policial. Para trocar:

```bash
node narrar.mjs --voz pt-BR-FranciscaNeural
node narrar.mjs --voz pt-BR-ThalitaMultilingualNeural --ritmo -5% --tom -6Hz
node narrar.mjs --forcar      # regrava tudo depois de trocar de voz
```

O script pula o que já existe, então dá para interromper e continuar depois. Terminando, publique de novo e os áudios sobem junto.

### Modo 3 — ElevenLabs (opcional, melhor qualidade)

O plano gratuito dá **10 000 créditos por mês**. A narração deste jogo:

| O que | Caracteres | Multilingual v2 | Flash v2.5 |
|---|---:|---:|---:|
| Abertura + desfecho dos 10 casos | 9 019 | 9 019 créditos | ~4 510 |
| Tudo, incluindo as 50 pistas | 19 282 | 19 282 créditos | ~9 641 |

Ou seja: **os 20 arquivos principais cabem na cota gratuita de um mês**, com cerca de 10% de folga. Com `--flash` (metade do custo por caractere) cabe o jogo inteiro, pistas e tudo.

```bash
export ELEVENLABS_API_KEY="sua-chave"

node narrar.mjs --elevenlabs --listar                  # vê os ids das vozes
node narrar.mjs --elevenlabs --voz <id> --limite 2     # grava 2, escute antes
node narrar.mjs --elevenlabs --voz <id>                # grava os 20
node narrar.mjs --elevenlabs --voz <id> --flash --pistas   # tudo, metade do custo
```

O `--limite` existe por causa da folga apertada: grave dois arquivos, ouça, e só então rode o resto. Como o script pula o que já existe, os dois primeiros não são refeitos. Se a voz não agradar, apague os MP3 e escolha outra — **mas cada regravação consome cota de novo**.

Escolha uma voz **multilingual**; as que só falam inglês ficam com sotaque carregado em português. A chave fica só no seu terminal — nunca dentro de um arquivo do projeto, e nunca no navegador.

**Sobre a licença:** o plano gratuito do ElevenLabs **não inclui licença comercial** e pede atribuição ao serviço. A licença comercial começa no plano Starter, US$ 6/mês. Para um projeto de estudo isso costuma bastar, mas leia os termos deles antes de usar em algo que gere receita — eu não sou advogado e isso não é orientação jurídica. O `edge-tts` não tem cota, mas é um cliente não oficial do serviço que a Microsoft oferece dentro do Edge, o que também é uma zona cinzenta fora dele. Se o jogo virar algo sério, o caminho limpo é um plano pago.

### Trocando de serviço

Qualquer outro serviço serve. Leia `narracao.json` e grave cada `texto` em `assets/audio/<arquivo>.mp3`. O jogo não sabe nem se importa com quem gerou o áudio — se o arquivo existe, ele toca; se não existe, ele cai na voz do navegador sem reclamar.

---

## Rodar na sua máquina

```bash
npx serve .
# ou
python3 -m http.server 8080
```

E abra <http://localhost:8080>.

---

## Detalhes que importam

**O motor SQL.** O `index.html` carrega `vendor/sql-asm.js` — a build asm.js do [sql.js](https://sql.js.org), que não precisa buscar nenhum `.wasm` separado. Se esse arquivo faltar, o jogo busca a mesma versão no jsDelivr. São 1,3 MB; servido pelo Vercel com cache imutável, carrega uma vez por visitante.

**As fontes** (Oswald, Libre Franklin, IBM Plex Mono) vêm do Google Fonts. Sem internet o jogo continua funcionando, só com as fontes de sistema.

**Os retratos** dos suspeitos são desenhados em SVG na hora, a partir do nome de cada um. Não há imagem nenhuma no projeto — por isso o site inteiro cabe em 190 KB.

**O progresso** de cada jogador fica no `localStorage` do navegador dele. Não há banco, não há conta, nada trafega para o servidor.

**Domínio próprio.** No painel do projeto, *Settings → Domains*.

---

## Mexer no conteúdo

Tudo está dentro do `index.html`, em blocos comentados no `<script>` do final:

- **MOTOR** — a tradução de sintaxe BigQuery → SQLite (`DATE_DIFF`, `COUNTIF`, `SAFE_DIVIDE`, `QUALIFY`, `EXTRACT`, crases, `INTERSECT DISTINCT`…)
- **CASOS** — os dez casos: briefing, `CREATE TABLE` + `INSERT`, pistas, dicas, consultas-solução, suspeitos e desfecho
- **ARTE** — o gerador de retratos e as ilustrações das provas
- **VOZ / CENA** — narração, abertura animada e animações
- **JOGO** — telas, pontuação, vidas, XP e trilha

Para acrescentar um caso, copie um objeto do array, troque o conteúdo e inclua o `id` novo em `ORDEM_TRILHA`, na posição em que ele deve aparecer. O `numero` é calculado sozinho.

Cada pista tem um campo `solucao`: o jogo roda essa consulta no banco do caso e compara o resultado com o que o jogador escreveu. Não existe gabarito fixo — qualquer consulta que devolva as mesmas linhas é aceita. Use `ordenado: true` só quando a ordem das linhas fizer parte da resposta.

Se mudar textos de briefing ou desfecho, regrave a narração daquele caso com `node narrar.mjs --forcar` (ou apague só os MP3 afetados).

---

Todos os casos são ficcionais. Pessoas, empresas, endereços e documentos foram inventados.
