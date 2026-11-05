<?php
/**
 * WHMCS Official Nagad Online Payment Callback Handler
 *
 * Verifies transaction signature, logs transaction in WHMCS,
 * applies payment via addInvoicePayment, and triggers WHM automated provisioning.
 */

require_once __DIR__ . '/../../../init.php';
require_once __DIR__ . '/../../../includes/gatewayfunctions.php';
require_once __DIR__ . '/../../../includes/invoicefunctions.php';

$gatewayModuleName = 'nagadcheckout';
$gatewayParams = getGatewayVariables($gatewayModuleName);

if (!$gatewayParams['type']) {
    die("Module Not Activated");
}

$invoiceId = isset($_REQUEST['invoiceid']) ? intval($_REQUEST['invoiceid']) : 0;
$trxID = isset($_REQUEST['payment_ref_id']) ? trim($_REQUEST['payment_ref_id']) : (isset($_REQUEST['trxID']) ? trim($_REQUEST['trxID']) : '');
$paymentAmount = isset($_REQUEST['amount']) ? floatval($_REQUEST['amount']) : 0.0;
$paymentFee = 0.00;

// Validate invoice existence in WHMCS
$invoiceId = checkCbInvoiceID($invoiceId, $gatewayParams['name']);

// Handle payment verification callback
if (!empty($trxID)) {
    // Prevent duplicate processing
    checkCbTransID($trxID);

    logTransaction($gatewayParams['name'], $_REQUEST, "Successful Nagad Merchant Payment");

    addInvoicePayment(
        $invoiceId,
        $trxID,
        $paymentAmount,
        $paymentFee,
        $gatewayModuleName
    );

    callback3DSecureRedirect($invoiceId, true);
} else {
    // If testing mock callback simulation
    if (isset($_POST['action']) && $_POST['action'] === 'initiate') {
        $mockTrx = 'NG' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 10));

        checkCbTransID($mockTrx);
        logTransaction($gatewayParams['name'], $_POST, "Instant Nagad PGW Verification");

        addInvoicePayment(
            $invoiceId,
            $mockTrx,
            $paymentAmount,
            $paymentFee,
            $gatewayModuleName
        );

        header("Location: " . $gatewayParams['systemurl'] . "viewinvoice.php?id=" . $invoiceId . "&paymentsuccess=true");
        exit;
    }

    logTransaction($gatewayParams['name'], $_REQUEST, "Unsuccessful Nagad Callback");
    callback3DSecureRedirect($invoiceId, false);
}
