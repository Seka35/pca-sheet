"use client";

import { useEffect } from 'react';
import ClientModal from './ClientModal';

/**
 * SimulationClientModal wraps the ClientModal component to work with
 * in-memory simulated client data (negative IDs) instead of real DB data.
 *
 * It intercepts fetch calls that ClientModal makes:
 * - GET /api/clients/:id → returns simulated client JSON
 * - GET /api/payments?client_id=X → returns flattened payment history from products
 */
export default function SimulationClientModal({
  selectedClient,
  onClose,
  onSaved,
  tierProducts = [],
  setupProducts = [],
}) {
  useEffect(() => {
    if (!selectedClient?.client?.id || selectedClient.client.id > 0) return;

    const simulatedId = selectedClient.client.id;
    const clientData = selectedClient;

    // Build flattened payment list from all product histories
    const allPayments = [];
    if (clientData.history && Array.isArray(clientData.history)) {
      clientData.history.forEach((product) => {
        if (product.history && Array.isArray(product.history)) {
          product.history.forEach((payment) => {
            allPayments.push({
              id: payment.reference_no || `${product.sr_no}_${payment.month}`,
              sr_no: product.sr_no || '',
              renewal_sr_no: product.sr_no || '',
              client_id: simulatedId,
              client_name: clientData.nom || '',
              client_status_history: product.client_status_history || '',
              month: payment.month || '',
              valid_stopped_date: product.valid_stopped_date || '',
              payment_name: payment.payment_name || '',
              bank_name: payment.bank_name || '',
              amount_received: payment.amount_received || 0,
              payment_received_date: payment.payment_date || '',
              payment_received_month: payment.month || '',
              actual_balance_difference: payment.actual_balance_difference || 0,
              source: 'payment_history',
              // Extra product info for display
              tier: product.tier || '',
              setup_type: product.setup_type || '',
              is_trial: product.is_trial || 0,
            });
          });
        }
      });
    }

    // Sort by payment date (most recent first)
    allPayments.sort((a, b) => {
      const dateA = a.payment_received_date || '';
      const dateB = b.payment_received_date || '';
      return dateB.localeCompare(dateA);
    });

    // Save original fetch
    const originalFetch = window.fetch;

    // Override fetch to intercept API calls for our simulated client
    window.fetch = async (url, options) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Intercept GET /api/clients/:id (pathname only, ignore query params)
      const clientsUrl = new URL(urlStr, 'http://localhost');
      const clientMatch = clientsUrl.pathname.match(/^\/api\/clients\/(-?\d+)(?:\/.*)?$/);
      if (clientMatch && parseInt(clientMatch[1], 10) === simulatedId) {
        console.log('[SimulationClientModal] INTERCEPTED client', simulatedId);
        return new Response(JSON.stringify(clientData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Intercept GET /api/payments?client_id=X (handle cache-busters like _cb=)
      const paymentsUrl = new URL(urlStr, 'http://localhost');
      console.log('[SimulationClientModal] intercepting payments:', paymentsUrl.pathname, 'client_id=', paymentsUrl.searchParams.get('client_id'), 'expected=', simulatedId, 'allPayments count:', allPayments.length);
      if (paymentsUrl.pathname === '/api/payments' && parseInt(paymentsUrl.searchParams.get('client_id'), 10) === simulatedId) {
        console.log('[SimulationClientModal] INTERCEPTED payments for client', simulatedId, '→ returning', allPayments.length, 'payments');
        return new Response(JSON.stringify(allPayments), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return originalFetch(url, options);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [selectedClient]);

  return (
    <ClientModal
      selectedClient={selectedClient}
      onClose={onClose}
      onSaved={onSaved}
      tierProducts={tierProducts}
      setupProducts={setupProducts}
    />
  );
}
