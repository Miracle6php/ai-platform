<?php

/*
|--------------------------------------------------------------------------
| backend/config/credit_pool.php
|--------------------------------------------------------------------------
| The "wholesale" credit pool — represents credits the admin has
| pre-purchased from Decart with real money. Every time a user buys
| credits (successful Paystack payment), that amount is drawn down
| from this pool and logged as "sold". The admin tops this pool back
| up manually (backend/admin/pool.php) after actually paying Decart.
|
| available_credits is intentionally allowed to go NEGATIVE — a user's
| payment already succeeded and they were already credited; refusing
| to record the sale because the admin hasn't topped up yet would be
| wrong. A negative number here is a signal ("you're overselling,
| top up soon"), not something this function blocks on.
|--------------------------------------------------------------------------
*/

if (!function_exists('record_platform_credit_sale')) {

    /**
     * Call this from inside the SAME transaction as the user-crediting
     * UPDATE, right after it succeeds. Never call this outside a
     * transaction — if the user-credit step rolls back, this must too.
     */
    function record_platform_credit_sale(mysqli $conn, float $creditsSold): void
    {
        if ($creditsSold <= 0) {
            return;
        }

        $stmt = $conn->prepare(
            "UPDATE platform_credit_pool
             SET available_credits = available_credits - ?,
                 total_sold = total_sold + ?
             WHERE id = 1"
        );
        $stmt->bind_param('dd', $creditsSold, $creditsSold);
        $stmt->execute();
        $stmt->close();
    }
}