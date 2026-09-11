# Representação monetária estrita em inteiros de centavos

Decidimos armazenar todos os valores monetários no banco SQLite e processá-los na camada de domínio como números inteiros representando centavos (`amount_cents`), delegando a formatação visual `BRL (R$)` exclusivamente à camada de apresentação. Isso elimina dízimas e erros clássicos de arredondamento de ponto flutuante do padrão IEEE 754 e simplifica a divisão exata de parcelas com sobras na primeira prestação.
