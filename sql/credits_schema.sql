-- Run this once against your `aistudio` database.
-- If you already ran the earlier version of this file, run the
-- ALTER/UPDATE block at the bottom instead of the CREATE TABLE block.

CREATE TABLE IF NOT EXISTS credit_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    credits DECIMAL(10,2) NOT NULL,
    price_cents BIGINT NOT NULL COMMENT 'Amount in US cents — what Paystack charges',
    description VARCHAR(255) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS credit_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_id INT NULL COMMENT 'NULL when the user paid a custom (non-plan) amount',
    reference VARCHAR(100) NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL COMMENT 'Amount paid, in USD',
    credits DECIMAL(10,2) NOT NULL COMMENT 'Credits to award once payment succeeds',
    status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
    paystack_response TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_credit_transactions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_credit_transactions_plan FOREIGN KEY (plan_id) REFERENCES credit_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Plans matching the pricing section on index.html.
-- Rate is fixed at $0.01 per credit (so price_cents == credits), matching
-- the site's stated rate: 100 credits per dollar.
INSERT INTO credit_plans (name, credits, price_cents, description, sort_order) VALUES
('Creator',     1500.00,  1500, '~4 minutes of face transformation.', 1),
('Pro',         4500.00,  4500, '~12.5 minutes of face transformation.', 2),
('Pro Creator', 15000.00, 15000, '~41.7 minutes of face transformation.', 3);


-- =====================================================================
-- If you already created the OLD version of this schema (price_kobo,
-- NGN-based), run this instead of the CREATE TABLE statements above:
-- =====================================================================
--
-- ALTER TABLE credit_plans CHANGE price_kobo price_cents BIGINT NOT NULL;
-- TRUNCATE TABLE credit_plans;
-- INSERT INTO credit_plans (name, credits, price_cents, description, sort_order) VALUES
-- ('Creator',     1500.00,  1500, '~4 minutes of face transformation.', 1),
-- ('Pro',         4500.00,  4500, '~12.5 minutes of face transformation.', 2),
-- ('Pro Creator', 15000.00, 15000, '~41.7 minutes of face transformation.', 3);
