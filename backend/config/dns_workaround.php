<?php
/**
 * backend/config/dns_workaround.php
 *
 * WORKAROUND for the Acode/Alpine sandbox — NOT needed on Railway.
 *
 * FIX (2026): this workaround pins specific IPs for api.decart.ai,
 * api.elevenlabs.io and api.paystack.co via CURLOPT_RESOLVE, skipping
 * normal DNS resolution. It was written to fix a DNS bug specific to
 * local on-device Acode/proot/Alpine sandboxes.
 *
 * Railway's containers do NOT have that DNS bug — they resolve DNS
 * normally. Keeping the pinned IPs active here is actively harmful:
 * CDN-backed hosts like api.decart.ai (CloudFront) rotate their IPs
 * over time, so a pinned IP captured during local Acode testing can
 * go stale and start silently failing or hanging on Railway, even
 * though normal DNS resolution would work fine.
 *
 * apply_dns_workaround() is now a NO-OP: it leaves curl to resolve
 * DNS normally in every environment. The pinned-IP map and logic are
 * kept below (commented out) only for reference, in case this project
 * ever needs to run in that specific Acode sandbox again.
 *
 * If you ever need to re-enable the pinning workaround for local
 * Acode testing only, guard it behind an environment check, e.g.:
 *
 *     if (getenv('DNS_WORKAROUND_ENABLED') === '1') { ... }
 *
 * so it never silently applies on Railway or any other real host.
 */

/*
const DNS_WORKAROUND_IPS = [
    'api.decart.ai'     => '18.164.78.101',
    'api.elevenlabs.io' => '34.8.184.191',
    'api.paystack.co'   => '104.18.28.7',
];
*/

if (!function_exists('apply_dns_workaround')) {

    /**
     * No-op on Railway / any normal host: curl resolves DNS itself.
     * Kept as a function (rather than removing every call site) so
     * transform.php, status.php, buy-credits.php and verify-payment.php
     * don't need to change at all.
     */
    function apply_dns_workaround($ch, ?string $host = null, int $port = 443): void
    {
        // Intentionally does nothing. See file header comment above.
        return;
    }
}
