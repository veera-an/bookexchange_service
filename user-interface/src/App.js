import React, { useState } from 'react';

const API_URL = '';

function App() {
  const [addBook, setAddBook] = useState({ name: '', author: '', isbn: '', publicationDate: '', genre: '' });
  const [addUser, setAddUser] = useState({ username: '', email: '', city: '' });
  const [returnTrade, setReturnTrade] = useState({ tradeId: '' });
  const [initTrade, setInitTrade] = useState({ bookId: '', requesterId: '' });
  const [acceptTrade, setAcceptTrade] = useState({ tradeId: '' });
  const [rejectTrade, setRejectTrade] = useState({ tradeId: '', reason: '' });
  const [result, setResult] = useState('');
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [showBooks, setShowBooks] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showTrades, setShowTrades] = useState(false);

  const handleChange = (setter) => (e) => {
    setter(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (url, method, data) => async (e) => {
    e.preventDefault();
    setResult('');
    try {
      const res = await fetch(typeof url === 'function' ? url() : url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeof data === 'function' ? data() : data)
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setResult('Error: ' + err.message);
    }
  };

  const fetchBooks = async () => {
    if (showBooks) { setShowBooks(false); return; }
    setResult('');
    try {
      const res = await fetch(`${API_URL}/books`);
      const json = await res.json();
      setBooks(json);
      setShowBooks(true);
    } catch (err) {
      setResult('Error: ' + err.message);
    }
  };

  const fetchUsers = async () => {
    if (showUsers) { setShowUsers(false); return; }
    setResult('');
    try {
      const res = await fetch(`${API_URL}/users`);
      const json = await res.json();
      setUsers(json);
      setShowUsers(true);
    } catch (err) {
      setResult('Error: ' + err.message);
    }
  };

  const fetchTrades = async () => {
    if (showTrades) { setShowTrades(false); return; }
    setResult('');
    try {
      const res = await fetch(`${API_URL}/trades`);
      const json = await res.json();
      setTrades(json);
      setShowTrades(true);
    } catch (err) {
      setResult('Error: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', gap: 32 }}>
        {/* Left Column — Book & User Service */}
        <div style={{ flex: 1 }}>
          <h1>Book & User Service</h1>
          <button onClick={fetchBooks} style={{ marginBottom: 16 }}>{showBooks ? 'Hide Books' : 'List Books'}</button>
          {showBooks && books.length > 0 && (
            <div style={{ background: '#e0e0e0', padding: 10, marginBottom: 16 }}>
              <h3>Books</h3>
              <ul>
                {books.map(book => (
                  <li key={book.book_id || book.bookId}>
                    <b>{book.name}</b> by {book.author} (Status: {book.status}) [ID: {book.book_id || book.bookId}]
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={fetchUsers} style={{ marginBottom: 16 }}>{showUsers ? 'Hide Users' : 'List Users'}</button>
          {showUsers && users.length > 0 && (
            <div style={{ background: '#e0e0e0', padding: 10, marginBottom: 16 }}>
              <h3>Users</h3>
              <ul>
                {users.map(user => (
                  <li key={user.user_id}>
                    <b>{user.username}</b> — {user.email} ({user.city}) [ID: {user.user_id}]
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h3>Add User</h3>
          <form onSubmit={handleSubmit(`${API_URL}/users`, 'POST', addUser)}>
            <input name="username" value={addUser.username} onChange={handleChange(setAddUser)} placeholder="username" required style={{ margin: 4 }} />
            <input name="email" value={addUser.email} onChange={handleChange(setAddUser)} placeholder="email" required style={{ margin: 4 }} />
            <input name="city" value={addUser.city} onChange={handleChange(setAddUser)} placeholder="city" required style={{ margin: 4 }} />
            <button type="submit">Add User</button>
          </form>

          <h3>Add Book</h3>
          <form onSubmit={handleSubmit(`${API_URL}/books`, 'POST', addBook)}>
            <input name="name" value={addBook.name} onChange={handleChange(setAddBook)} placeholder="name" required style={{ margin: 4 }} />
            <input name="author" value={addBook.author} onChange={handleChange(setAddBook)} placeholder="author" required style={{ margin: 4 }} />
            <input name="isbn" value={addBook.isbn} onChange={handleChange(setAddBook)} placeholder="isbn" required style={{ margin: 4 }} />
            <input name="publicationDate" value={addBook.publicationDate} onChange={handleChange(setAddBook)} placeholder="publicationDate" required style={{ margin: 4 }} />
            <input name="genre" value={addBook.genre} onChange={handleChange(setAddBook)} placeholder="genre" required style={{ margin: 4 }} />
            <button type="submit">Add</button>
          </form>

        </div>

        {/* Right Column — Exchange Service */}
        <div style={{ flex: 1 }}>
          <h1>Exchange Service</h1>
          <button onClick={fetchTrades} style={{ marginBottom: 16 }}>{showTrades ? 'Hide Trades' : 'List Trades'}</button>
          {showTrades && trades.length > 0 && (
            <div style={{ background: '#e0e0e0', padding: 10, marginBottom: 16 }}>
              <h3>Trades</h3>
              <ul>
                {trades.map(trade => (
                  <li key={trade.trade_id}>
                    Trade <b>{trade.trade_id}</b> — Book #{trade.book_id} — Status: <b>{trade.status}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3>Initiate Trade</h3>
          <form onSubmit={handleSubmit(`${API_URL}/trades`, 'POST', initTrade)}>
            <input name="bookId" value={initTrade.bookId} onChange={handleChange(setInitTrade)} placeholder="bookId" required style={{ margin: 4 }} />
            <input name="requesterId" value={initTrade.requesterId} onChange={handleChange(setInitTrade)} placeholder="requesterId (UUID)" required style={{ margin: 4, width: 220 }} />
            <button type="submit">Initiate Trade</button>
          </form>

          <h3>Accept Trade</h3>
          <form onSubmit={handleSubmit(() => `${API_URL}/trades/${acceptTrade.tradeId}/accept`, 'POST', () => ({}))}>
            <input name="tradeId" value={acceptTrade.tradeId} onChange={handleChange(setAcceptTrade)} placeholder="tradeId (UUID)" required style={{ margin: 4, width: 300 }} />
            <button type="submit">Accept</button>
          </form>

          <h3>Reject Trade</h3>
          <form onSubmit={handleSubmit(() => `${API_URL}/trades/${rejectTrade.tradeId}/reject`, 'POST', () => ({ reason: rejectTrade.reason }))}>
            <input name="tradeId" value={rejectTrade.tradeId} onChange={handleChange(setRejectTrade)} placeholder="tradeId (UUID)" required style={{ margin: 4, width: 300 }} />
            <input name="reason" value={rejectTrade.reason} onChange={handleChange(setRejectTrade)} placeholder="reason" style={{ margin: 4 }} />
            <button type="submit">Reject</button>
          </form>

          <h3>Return Book (via Trade)</h3>
          <form onSubmit={handleSubmit(() => `${API_URL}/trades/${returnTrade.tradeId}/return`, 'POST', () => ({}))}>
            <input name="tradeId" value={returnTrade.tradeId} onChange={handleChange(setReturnTrade)} placeholder="tradeId (UUID)" required style={{ margin: 4, width: 300 }} />
            <button type="submit">Return</button>
          </form>
        </div>
      </div>

      <h2>Result</h2>
      <pre style={{ background: '#f0f0f0', padding: 10 }}>{result}</pre>
    </div>
  );
}

export default App;
