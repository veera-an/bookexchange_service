import React, { useState } from 'react';

const API_URL = 'http://localhost:5002';

function App() {
  const [addBook, setAddBook] = useState({ bookId: '', name: '', author: '', isbn: '', publicationDate: '', genre: '' });
  const [updateBook, setUpdateBook] = useState({ bookId: '', name: '', status: '' });
  const [reserve, setReserve] = useState({ bookId: '', userId: '' });
  const [returnBook, setReturnBook] = useState({ bookId: '', userId: '' });
  const [result, setResult] = useState('');
  const [books, setBooks] = useState([]);

  const handleChange = (setter) => (e) => {
    setter(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (url, method, data) => async (e) => {
    e.preventDefault();
    setResult('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setResult('Error: ' + err.message);
    }
  };

  const fetchBooks = async () => {
    setResult('');
    try {
      const res = await fetch(`${API_URL}/books`);
      const json = await res.json();
      setBooks(json);
    } catch (err) {
      setResult('Error: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Book Service UI</h1>
      <button onClick={fetchBooks} style={{ marginBottom: 16 }}>List Books</button>
      {books.length > 0 && (
        <div style={{ background: '#e0e0e0', padding: 10, marginBottom: 16 }}>
          <h2>Books</h2>
          <ul>
            {books.map(book => (
              <li key={book.bookId}>
                <b>{book.name}</b> by {book.author} (Status: {book.status})
              </li>
            ))}
          </ul>
        </div>
      )}
      <h2>Add Book</h2>
      <form onSubmit={handleSubmit(`${API_URL}/books`, 'POST', addBook)}>
        {Object.keys(addBook).map(key => (
          <input key={key} name={key} value={addBook[key]} onChange={handleChange(setAddBook)} placeholder={key} required style={{ margin: 4 }} />
        ))}
        <button type="submit">Add</button>
      </form>

      <h2>Update Book</h2>
      <form onSubmit={handleSubmit(`${API_URL}/books/${updateBook.bookId}`, 'PUT', { name: updateBook.name, status: updateBook.status })}>
        <input name="bookId" value={updateBook.bookId} onChange={handleChange(setUpdateBook)} placeholder="bookId" required style={{ margin: 4 }} />
        <input name="name" value={updateBook.name} onChange={handleChange(setUpdateBook)} placeholder="name" required style={{ margin: 4 }} />
        <input name="status" value={updateBook.status} onChange={handleChange(setUpdateBook)} placeholder="status" required style={{ margin: 4 }} />
        <button type="submit">Update</button>
      </form>

      <h2>Reserve Book</h2>
      <form onSubmit={handleSubmit(`${API_URL}/books/${reserve.bookId}/reserve`, 'POST', { userId: reserve.userId })}>
        <input name="bookId" value={reserve.bookId} onChange={handleChange(setReserve)} placeholder="bookId" required style={{ margin: 4 }} />
        <input name="userId" value={reserve.userId} onChange={handleChange(setReserve)} placeholder="userId" required style={{ margin: 4 }} />
        <button type="submit">Reserve</button>
      </form>

      <h2>Return Book</h2>
      <form onSubmit={handleSubmit(`${API_URL}/books/${returnBook.bookId}/return`, 'POST', { userId: returnBook.userId })}>
        <input name="bookId" value={returnBook.bookId} onChange={handleChange(setReturnBook)} placeholder="bookId" required style={{ margin: 4 }} />
        <input name="userId" value={returnBook.userId} onChange={handleChange(setReturnBook)} placeholder="userId" required style={{ margin: 4 }} />
        <button type="submit">Return</button>
      </form>

      <h2>Result</h2>
      <pre style={{ background: '#f0f0f0', padding: 10 }}>{result}</pre>
    </div>
  );
}

export default App;
