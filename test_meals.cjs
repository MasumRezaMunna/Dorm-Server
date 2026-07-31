const mongoose = require('mongoose');

async function test() {
  const d1 = new Date("2026-08-01");
  const filterDateGte = new Date(d1.setHours(0, 0, 0, 0));
  const filterDateLt = new Date(d1.setHours(23, 59, 59, 999));
  
  console.log("Query range for 2026-08-01:");
  console.log("gte:", filterDateGte.toISOString());
  console.log("lt:", filterDateLt.toISOString());

  const insertedDate = new Date("2026-07-31");
  console.log("Inserted date for 2026-07-31:");
  console.log(insertedDate.toISOString());
  
  if (insertedDate >= filterDateGte && insertedDate < filterDateLt) {
    console.log("BUG: The inserted date falls into the next day's query range!");
  } else {
    console.log("The inserted date DOES NOT fall into the next day's query range.");
  }
}

test();
