// ---------- 1. Select the elements we need ----------
const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadBtn = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusText = document.querySelector("#status");
const list = document.querySelector("#users-list");

// ---------- 2. Data: the loaded users live in one array ----------
let users = [];

// ---------- 3. Draw any array of users ----------
function renderUsers(userList) {
  list.innerHTML = ""; // clear the old list (no user text here)

  // Users are loaded, but the filter matched none of them
  if (users.length > 0 && userList.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No users match your filter.";
    list.appendChild(empty);
    return;
  }

  userList.forEach((user) => {
    const li = document.createElement("li");

    const name = document.createElement("strong");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    li.appendChild(name);
    li.appendChild(email);
    li.appendChild(city);
    li.appendChild(company);
    list.appendChild(li);
  });
}

// ---------- 4. Filter the stored array (no new request) ----------
function getFilteredUsers() {
  const term = filterInput.value.trim().toLowerCase();
  return users.filter((user) => user.name.toLowerCase().includes(term));
}

// ---------- 5. Load users from the server ----------
async function loadUsers() {
  statusText.textContent = "Loading users...";
  loadBtn.disabled = true;
  list.innerHTML = "";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    users = await response.json();
    renderUsers(getFilteredUsers());
    statusText.textContent = `Loaded ${users.length} users.`;
  } catch (error) {
    users = [];
    statusText.textContent = "Could not load users. Please try again.";
    console.error(error);
  } finally {
    loadBtn.disabled = false; // runs whether it worked or failed
  }
}

// ---------- 6. Listen for events ----------
loadBtn.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  renderUsers(getFilteredUsers());
});
