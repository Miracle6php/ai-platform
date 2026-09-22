<?php

session_start();

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/backend/config/database.php';
require_once __DIR__ . '/backend/config/paystack.php';


/*
|--------------------------------------------------------------------------
| Must be logged in
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true ||
    !isset($_SESSION['user_id'])
) {
    header('Location: login.php');
    exit;
}

$userId = (int) $_SESSION['user_id'];

$stmt = $conn->prepare("SELECT credits_balance FROM users WHERE id = ? LIMIT 1");
$stmt->bind_param('i', $userId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt->close();
    $conn->close();
    session_unset();
    session_destroy();
    header('Location: login.php?error=invalid');
    exit;
}

$user = $result->fetch_assoc();
$stmt->close();

$userCreditsDisplay = number_format((float) $user['credits_balance'], 2);


/*
|--------------------------------------------------------------------------
| Load active plans
|--------------------------------------------------------------------------
*/

$plans = [];
$plansResult = $conn->query(
    "SELECT id, name, credits, price_cents, description
     FROM credit_plans
     WHERE is_active = 1
     ORDER BY sort_order ASC, id ASC"
);

if ($plansResult) {
    while ($row = $plansResult->fetch_assoc()) {
        $plans[] = $row;
    }
}

$conn->close();

?>
<!DOCTYPE html>
<html lang="en">
<head>

    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Buy AI credits on AIStudio.">

    <title>Buy Credits — AIStudio</title>

    <!-- Bootstrap -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">

    <!-- Google Font -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

    <!-- Reuse existing styles: pricing-card etc. come from style.css -->
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css">
    <link rel="stylesheet" href="css/buy-credits.css">

</head>

<body>

<div class="plans-page">

    <header class="plans-topbar">

        <a href="dashboard.php" class="plans-back-link">
            <i class="bi bi-arrow-left"></i>
            Back to Dashboard
        </a>

        <div class="credits-pill">
            <i class="bi bi-coin"></i>
            <span id="currentCredits"><?php echo $userCreditsDisplay; ?></span>
        </div>

    </header>


    <div class="plans-container">

        <div class="section-heading text-center mx-auto">

            <span class="section-eyebrow">
                BUY CREDITS
            </span>

            <h1>
                Buy credits, use them your way
            </h1>

            <p>
                No subscriptions. Pick a plan below, or buy any amount
                you like. 100 credits = $1. Pay securely with Paystack —
                credits are added to your account instantly.
            </p>

        </div>


        <div id="plansAlert" class="plans-alert" style="display:none;"></div>


        <?php if (!empty($plans)): ?>

            <div class="row g-4 pricing-grid mt-4">

                <?php foreach ($plans as $plan): ?>

                    <div class="col-lg-4 col-md-6">

                        <div class="pricing-card">

                            <div class="pricing-top">

                                <span class="pricing-label">
                                    <?php echo htmlspecialchars($plan['name'], ENT_QUOTES, 'UTF-8'); ?>
                                </span>

                                <h3>
                                    $<?php echo number_format($plan['price_cents'] / 100, 2); ?>
                                </h3>

                                <p>
                                    <?php echo htmlspecialchars((string) $plan['description'], ENT_QUOTES, 'UTF-8'); ?>
                                </p>

                            </div>

                            <div class="pricing-divider"></div>

                            <ul>

                                <li>
                                    <i class="bi bi-coin"></i>
                                    <?php echo number_format((float) $plan['credits'], 0); ?> credits
                                </li>

                            </ul>

                            <button
                                type="button"
                                class="btn btn-primary-custom w-100 plan-select-btn"
                                data-plan-id="<?php echo (int) $plan['id']; ?>"
                            >
                                Select Plan
                            </button>

                        </div>

                    </div>

                <?php endforeach; ?>


                <!-- Custom amount -->

                <div class="col-lg-4 col-md-6">

                    <div class="pricing-card">

                        <div class="pricing-top">

                            <span class="pricing-label">
                                CUSTOM
                            </span>

                            <h3>
                                Any amount
                            </h3>

                            <p>
                                Choose your own amount — 100 credits per dollar.
                            </p>

                        </div>

                        <div class="pricing-divider"></div>

                        <div class="custom-amount-field">

                            <span class="custom-amount-prefix">$</span>

                            <input
                                type="number"
                                id="customAmountInput"
                                class="custom-amount-input"
                                min="<?php echo (int) CUSTOM_PURCHASE_MIN_USD; ?>"
                                max="<?php echo (int) CUSTOM_PURCHASE_MAX_USD; ?>"
                                step="0.01"
                                placeholder="10.00"
                            >

                        </div>

                        <p class="custom-amount-hint">
                            <span id="customAmountCredits">&nbsp;</span>
                        </p>

                        <button
                            type="button"
                            class="btn btn-outline-custom w-100"
                            id="customAmountBtn"
                        >
                            Buy Credits
                        </button>

                    </div>

                </div>

            </div>

        <?php else: ?>

            <div class="plans-empty">

                <i class="bi bi-inboxes"></i>

                <p>
                    No credit plans are available right now.
                    Please check back soon.
                </p>

            </div>

        <?php endif; ?>

    </div>

</div>


<script>
document.addEventListener("DOMContentLoaded", function () {

    const alertBox = document.getElementById("plansAlert");
    const minAmount = <?php echo (float) CUSTOM_PURCHASE_MIN_USD; ?>;
    const maxAmount = <?php echo (float) CUSTOM_PURCHASE_MAX_USD; ?>;

    function showAlert(message, type) {
        alertBox.textContent = message;
        alertBox.className = "plans-alert plans-alert-" + type;
        alertBox.style.display = "block";
    }

    function setButtonsDisabled(disabled) {
        document.querySelectorAll(".plan-select-btn, #customAmountBtn").forEach(function (b) {
            b.disabled = disabled;
        });
    }

    function startCheckout(button, formData) {

        const originalText = button.innerHTML;

        setButtonsDisabled(true);
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Redirecting...';

        fetch("backend/payments/create-payment.php", {
            method: "POST",
            body: formData
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {

                if (data.success && data.authorization_url) {
                    window.location.href = data.authorization_url;
                    return;
                }

                showAlert(data.message || "Could not start payment. Please try again.", "error");
                setButtonsDisabled(false);
                button.innerHTML = originalText;

            })
            .catch(function () {

                showAlert("Something went wrong. Please try again.", "error");
                setButtonsDisabled(false);
                button.innerHTML = originalText;

            });

    }

    // Fixed plans

    document.querySelectorAll(".plan-select-btn").forEach(function (button) {

        button.addEventListener("click", function () {

            const formData = new FormData();
            formData.append("plan_id", this.getAttribute("data-plan-id"));

            startCheckout(this, formData);

        });

    });

    // Custom amount

    const customInput = document.getElementById("customAmountInput");
    const customHint = document.getElementById("customAmountCredits");
    const customBtn = document.getElementById("customAmountBtn");

    if (customInput && customHint) {

        customInput.addEventListener("input", function () {

            const value = parseFloat(this.value);

            if (!isNaN(value) && value > 0) {
                customHint.textContent = Math.round(value * 100).toLocaleString() + " credits";
            } else {
                customHint.textContent = "";
            }

        });

    }

    if (customBtn && customInput) {

        customBtn.addEventListener("click", function () {

            const value = parseFloat(customInput.value);

            if (isNaN(value) || value < minAmount || value > maxAmount) {
                showAlert("Enter an amount between $" + minAmount + " and $" + maxAmount + ".", "error");
                return;
            }

            const formData = new FormData();
            formData.append("amount_usd", value.toFixed(2));

            startCheckout(this, formData);

        });

    }

});
</script>

</body>
</html>
