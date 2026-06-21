# Spécifications : Système de Vérification Automatique des Paiements

Ce document explique comment implémenter la vérification automatique des paiements envoyés par les clients via Telegram pour le nouveau système.

## Objectif du Système
1. **Réception** : Le client envoie son moyen de paiement et l'ID de transaction (TX) au bot.
2. **Vérification automatique** : Le bot interroge l'API correspondante pour trouver la transaction et vérifier sa validité (montant, date, unicité).
3. **Cron Job** : Si le paiement n'est pas trouvé (délais bancaires), un cron le revérifie toutes les heures pendant X jours.
4. **Validation hybride** : Le résultat du bot (Validé/Échec/En attente) est affiché sur le dashboard admin pour faciliter l'approbation manuelle.

---

## 1. APIs et Parsing par Moyen de Paiement

### A. Crypto (USDT ERC20) - Etherscan

*   **Endpoint** : `GET https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&contractaddress={CONTRACT}&address={WALLET_RECEPTEUR}&apikey={ETHERSCAN_API_KEY}`
*   **Parsing** : 
    *   Chercher la transaction où `hash == TX_CLIENT`.
    *   Vérifier que `to` est bien notre wallet.
    *   Montant réel = `value / 1_000_000` (car USDT a 6 décimales).

### B. Crypto (USDT TRC20) - Tronscan

*   **Endpoint** : `GET https://apilist.tronscanapi.com/api/transfer/trc20?address={WALLET_RECEPTEUR}&trc20Id={CONTRACT}`
*   **Parsing** : 
    *   Chercher dans la liste `token_transfers` où `transaction_id == TX_CLIENT`.
    *   Vérifier que `to_address` est bien notre wallet.
    *   Montant réel = `quant / 1_000_000`.

### C. Crypto (Bitcoin) - Blockchain.info

*   **Endpoint** : `GET https://blockchain.info/rawaddr/{WALLET_RECEPTEUR}`
*   **Parsing** : 
    *   Chercher dans la liste `txs` où `hash == TX_CLIENT`.
    *   Parcourir le tableau `out` de la transaction pour trouver l'objet où `addr == NOTRE_WALLET`.
    *   Montant réel = `value / 100_000_000` (Satoshis -> BTC).

### D. Slash Bank

*   **Endpoint** : `GET https://api.joinslash.com/transaction`
*   **Headers** : `X-API-Key: {SLASH_API_KEY}`, `x-legal-entity: {SLASH_LEGAL_ENTITY_1 ou SLASH_LEGAL_ENTITY_2 selon la société visée}`
*   **Parsing** : 
    *   Chercher dans la liste `items` où `id == TX_CLIENT`.
    *   Vérifier que `amountCents` est positif (encaissement).
    *   Vérifier le statut (ex: `settled` et non `pending`).

### E. WHOP

*   **Endpoint** : `GET https://api.whop.com/api/v1/payments?company_id={WHOP_COMPANY_ID}`
*   **Headers** : `Authorization: Bearer {WHOP_API_KEY}`
*   **Parsing** : 
    *   Chercher où `id == TX_CLIENT`.
    *   S'assurer que `status == "paid"` et `total > 0`.

### F. AS LHV Pank (Sokin / Virement bancaire)

*   *Note technique* : Il n'y a pas d'API directe configurée dans le code de base pour cette banque.
*   **Solution proposée** : Mettre en place un script de parsing des emails de réception de virement (via IMAP ou API Gmail) pour chercher le nom du client ou une référence spécifique dans les virements reçus.

---

## 2. Logique Anti-Fraude (Checklist de l'IA)

Lorsqu'une transaction est trouvée via l'API, l'IA doit impérativement valider ces critères avant de la marquer comme "Vérifiée" :

1. **Existence** : L'ID ou le Hash fourni correspond bien à une transaction réelle sur le réseau/banque.
2. **Direction** : La transaction est bien "entrante" vers l'un de **nos** comptes/wallets.
3. **Montant** : Le montant reçu correspond au prix du produit attendu.
4. **Fraîcheur (Date)** : La date de la transaction doit être récente (ex: < 48h). Cela empêche un client d'utiliser un vieux hash valide d'il y a 3 mois pour payer son abonnement du mois courant.
5. **Unicité (Déduplication)** : L'ID de transaction ne doit pas déjà exister dans notre base de données comme ayant "déjà servi" à payer un autre produit ou mois précédent.

## 3. Implémentation du Cron / Workflow

1. Le client envoie la preuve -> Statut en BDD : `EN_ATTENTE_VERIF_AUTO`.
2. Le Cron s'exécute toutes les heures. Il prend tous les paiements `EN_ATTENTE_VERIF_AUTO` vieux de moins de `X` jours (ex: 3 jours max pour les virements qui prennent le weekend).
3. Le Cron appelle l'API correspondante au moyen de paiement.
    * Si la vérification réussit (Anti-Fraude = OK) -> Statut BDD : `AUTO_VALIDE`.
    * Si la transaction est trouvée mais avec un problème (montant incorrect, vieux paiement) -> Statut BDD : `AUTO_ECHOUE` + Note explicative.
    * Si introuvable (pas encore reçue) -> Reste `EN_ATTENTE_VERIF_AUTO`.
4. Sur le Dashboard Admin, l'humain voit un badge :
   * 🟢 "Vérifié par Bot" (Facilite l'approbation en 1 clic)
   * 🔴 "Invalide : Montant incorrect"
   * 🟠 "En attente de réception (Bot n'a rien vu encore)"

---

## 4. Variables d'Environnement (.env) Requises

Voici les configurations et clés d'API nécessaires (basées sur les accès actuels) à fournir à l'IA pour qu'elle puisse s'authentifier auprès des différentes banques et services :

```env
# Slash Bank
SLASH_API_KEY=0fe09e05f9935e44100c30130816da94bca5a401c6ad3da8e43f4cbc580f8e42
# Utilisé pour vérifier WCATFM LLC (Bot Principal)
SLASH_LEGAL_ENTITY_1=le_3orsd7r7qv5om
# Utilisé pour vérifier DG SOLUTION LLC (Bot DG)
SLASH_LEGAL_ENTITY_2=le_35wknq2fvyito
SLASH_ACCOUNT_1=sa_group_3toevzozk5ven

# Whop
WHOP_API_KEY=apik_L268w5D8fXZUy_A2050084_C_747dafeb8701235b6dc9bf857f03135e83b829a4d74047010e68868d42db25
WHOP_COMPANY_ID=biz_EaJCuJVbfR98Ec

# Crypto (Etherscan)
ETHERSCAN_API_KEY=X52Z4WDAUVMISBZ9UV4UDTVWJIMGBPM4AT
```
