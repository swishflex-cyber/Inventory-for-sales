const db = require('./database');

db.serialize(() => {
    console.log("Resetting financial data...");

    // Clear inventory logs (Revenue)
    db.run(`DELETE FROM inventory_logs`, (err) => {
        if (err) console.error("Error clearing inventory:", err);
        else console.log("✅ Inventory logs cleared.");
    });

    // Clear payroll logs (Labor costs)
    db.run(`DELETE FROM payroll_logs`, (err) => {
        if (err) console.error("Error clearing payroll:", err);
        else console.log("✅ Payroll logs cleared.");
    });

    // Clear daily reports (Generated profit data)
    db.run(`DELETE FROM daily_reports`, (err) => {
        if (err) console.error("Error clearing reports:", err);
        else console.log("✅ Daily reports cleared. Profit reset to 0.");
    });

    // Note: This does NOT delete your users. 
    // You will still be able to log in with your PIN.
});