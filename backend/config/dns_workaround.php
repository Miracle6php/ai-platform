<?php
/**
 * backend/config/dns_workaround.php
 *
 * WORKAROUND for the Acode/Alpine sandbox — not a permanent fix.
 *
 * Symptom this addresses: curl fails with "Could not resolve host:
 * ..." (errno 6) even though /etc/resolv.conf looks correct and raw
 * connectivity works. This is a known failure mode in some on-device
 * proot/Alpine sandboxes, where DNS resolution specifically breaks
 * inside curl.
 *
 * This tells curl to skip DNS for a known set of hosts and connect
 * straight to a pinned IP instead, via CURLOPT_RESOLVE. The hostname
 * is still sent correctly for TLS/SNI and the Host header, so the
 * request is otherwise identical to a normal DNS-resolved one — only
 * the lookup step is skipped.
 *
 * CAVEAT: these IPs can change (especially api.decart.ai, which is
 * served via CloudFront). If a call that previously worked starts
 * failing with a *connection* error (not a DNS error) after this was
 * applied, re-resolve the host from a machine with working DNS and
 * update the map below:
 *
 *   python3 -c "import socket; print(socket.gethostbyname('HOST'))"
 *
 * Once this environment's real DNS issue is fixed (or the project
 * moves to a normal server), this file and its call sites can be
 * removed — nothing else depends on it.
 */

const DNS_WORKAROUND_IPS = [
    'api.decart.ai'     => '18.164.78.101',
    'api.elevenlabs.io' => '34.8.184.191',
    'api.paystack.co'   => '104.18.28.7',
];

if (!function_exists('apply_dns_workaround')) {

    /**
     * Call this on a curl handle right after curl_init(), before
     * curl_setopt_array(). Infers the host from the handle's URL if
     * $host isn't passed explicitly.
     */
    function apply_dns_workaround($ch, ?string $host = null, int $port = 443): void
    {
        if ($host === null) {
            $info = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
            $host = $info ? (parse_url($info, PHP_URL_HOST) ?? '') : '';
        }

        if (!isset(DNS_WORKAROUND_IPS[$host])) {
            // Unknown host — nothing to do, let curl resolve normally.
            return;
        }

        curl_setopt($ch, CURLOPT_RESOLVE, [
            "{$host}:{$port}:" . DNS_WORKAROUND_IPS[$host],
        ]);
    }
}
