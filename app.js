// Require the sqlite3 module and set it to verbose mode
const sqlite3 = require("sqlite3").verbose();

// Create a new database or open the existing one
let db = new sqlite3.Database(
  "./filters.db",
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log("Connected to the filters.db database.");
    }
  }
);

// Create the filters table
let createTable = () => {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE filters(
      filter_id INTEGER PRIMARY KEY,
      filter_name TEXT UNIQUE,
      cycle_start_date TEXT
    )`,
      (err) => {
        if (err) {
          reject(err.message);
        }
        resolve(true);
      }
    );
  });
};

// Insert data into the filters table
let insertData = () => {
  return new Promise((resolve, reject) => {
    var insert =
      "INSERT OR IGNORE INTO filters (filter_name, cycle_start_date) VALUES (?,?)";
    db.run(insert, [
      'Filtro polipropileno 5 micras 10"x2.75"',
      new Date().toISOString(),
    ]);
    db.run(insert, [
      'Filtro carbón block de 10"x2.75"',
      new Date().toISOString(),
    ]);
    db.run(insert, ['Filtro granulado de 10"x2.75"', new Date().toISOString()]);
    db.run(
      insert,
      ['Postfiltro calcita de 10"x2.75"', new Date().toISOString()],
      (err) => {
        if (err) {
          reject(err.message);
        }
        resolve(true);
      }
    );
  });
};

// Fetch all filters from the database
let getAllFilters = () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM filters`, [], (err, rows) => {
      if (err) {
        reject(err.message);
      }
      resolve(rows);
    });
  });
};

// Fetch a filter by its ID
let getFilterById = (id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM filters WHERE filter_id = ?`, [id], (err, row) => {
      if (err) {
        reject(err.message);
      }
      resolve(row);
    });
  });
};

// Call the createTable function and chain the insertData function
createTable()
  .then((success) => {
    return insertData();
  })
  .then((success) => {
    console.log("Filters data has been successfully inserted");
  })
  .catch((err) => {
    console.log("There was an error: ", err);
  });

const express = require("express");
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000;

// GET all filters
app.get("/filters", async (req, res) => {
  try {
    let filters = await getAllFilters();
    res.status(200).json({
      filters,
    });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

// GET a specific filter

app.get("/filters/:id", async (req, res) => {
  try {
    let filter = await getFilterById(req.params.id);
    if (!filter) {
      res.status(404).json({ error: "Filter not found" });
    } else {
      res.status(200).json({
        filter,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

// Update a filter's cycle_start_date
let updateFilterDate = (id, date) => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE filters SET cycle_start_date = ? WHERE filter_id = ?`,
      [date, id],
      function (err) {
        if (err) {
          reject(err.message);
        }
        resolve(this.changes);
      }
    );
  });
};
// PATCH a specific filter's date
app.patch("/filters/:id", async (req, res) => {
  try {
    // Make sure a date was provided
    if (!req.body.date) {
      return res.status(400).json({ error: "You must provide a new date" });
    }

    // Update the filter
    let changes = await updateFilterDate(req.params.id, req.body.date);

    // Check if any rows were actually updated
    if (changes < 1) {
      return res.status(404).json({ error: "Filter not found" });
    }

    // Fetch the updated filter and return it
    let updatedFilter = await getFilterById(req.params.id);
    res.status(200).json({ filter: updatedFilter });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
// Close the database connection when the process is terminated
process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing SQLite database connection...");

  db.close((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log("Database connection closed.");
    }
  });

  console.log("Exiting process...");
  process.exit(0);
});
