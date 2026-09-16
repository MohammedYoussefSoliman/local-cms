---
paths:
  - '**/*.tsx'
  - '**/*.ts'
---

# React useEffect Rules

`useEffect` is an escape hatch for synchronizing with **external systems** (browser APIs, third-party widgets, network subscriptions). If no external system is involved, you almost certainly do not need it. Follow these rules strictly.

---

## When useEffect Is Allowed

Only use `useEffect` when synchronizing with something **outside of React**:

- Subscribing to browser APIs (`window`, `navigator`, `ResizeObserver`, etc.)
- Keeping a third-party (non-React) widget in sync with state
- Firing analytics events because a component was displayed to the user
- Data fetching — but always with cleanup to prevent race conditions, and prefer **TanStack Query** instead

**Key question to ask:** "Does this code run because the component appeared on screen, or because a user did something?" If it's a user action, it belongs in an event handler, not an effect.

---

## Rule 1 — Never use useEffect to derive or transform state

Calculate values directly during rendering. Effects that set state immediately cause an extra render cycle (stale render → effect fires → re-render).

```tsx
// ❌ Avoid — redundant state + unnecessary effect
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(firstName + ' ' + lastName);
}, [firstName, lastName]);

// ✅ Derive during render
const fullName = firstName + ' ' + lastName;
```

```tsx
// ❌ Avoid — filtering in an effect
const [visibleTodos, setVisibleTodos] = useState([]);
useEffect(() => {
  setVisibleTodos(getFilteredTodos(todos, filter));
}, [todos, filter]);

// ✅ Derive during render (use useMemo only if proven slow)
const visibleTodos = getFilteredTodos(todos, filter);

// ✅ If the calculation is expensive
const visibleTodos = useMemo(
  () => getFilteredTodos(todos, filter),
  [todos, filter],
);
```

---

## Rule 2 — Never use useEffect to reset or adjust state on prop change

Use a `key` to reset an entire component tree when a prop changes. To adjust only part of the state, do it during rendering by comparing with the previous value — not in an effect.

```tsx
// ❌ Avoid — resetting state in an effect
useEffect(() => {
  setComment('');
}, [userId]);

// ✅ Pass key to the component to fully reset it
export function ProfilePage({ userId }) {
  return <Profile userId={userId} key={userId} />;
}
```

```tsx
// ❌ Avoid — adjusting selection in an effect
useEffect(() => {
  setSelection(null);
}, [items]);

// ✅ Best — store the ID, derive the selected item during render
const selection = items.find((item) => item.id === selectedId) ?? null;

// ✅ Acceptable — adjust during render using prevItems pattern
const [prevItems, setPrevItems] = useState(items);
if (items !== prevItems) {
  setPrevItems(items);
  setSelection(null);
}
```

---

## Rule 3 — Never use useEffect for event-specific logic

If code must run because a user pressed a button, clicked, or submitted a form — it belongs in the event handler, not an effect. By the time an effect runs, the triggering interaction is unknown.

```tsx
// ❌ Avoid — event-driven notification via effect
useEffect(() => {
  if (product.isInCart) {
    showNotification(`Added ${product.name} to the cart!`);
  }
}, [product]);

// ✅ Trigger directly from the event handler
function handleBuyClick() {
  addToCart(product);
  showNotification(`Added ${product.name} to the cart!`);
}
```

When two handlers share logic, extract a named function — don't introduce an effect:

```tsx
// ✅ Shared logic as a named function
function buyProduct() {
  addToCart(product);
  showNotification(`Added ${product.name} to the cart!`);
}
function handleBuyClick() {
  buyProduct();
}
function handleCheckoutClick() {
  buyProduct();
  navigateTo('/checkout');
}
```

---

## Rule 4 — Never chain Effects to trigger each other

Effects that set state to trigger other effects create cascading re-renders and fragile code. Compute everything in one pass during the event handler.

```tsx
// ❌ Avoid — effect chains
useEffect(() => {
  if (card?.gold) setGoldCardCount((c) => c + 1);
}, [card]);

useEffect(() => {
  if (goldCardCount > 3) {
    setRound((r) => r + 1);
    setGoldCardCount(0);
  }
}, [goldCardCount]);

// ✅ Calculate all next state in the event handler
function handlePlaceCard(nextCard) {
  setCard(nextCard);
  if (nextCard.gold) {
    if (goldCardCount < 3) {
      setGoldCardCount(goldCardCount + 1);
    } else {
      setGoldCardCount(0);
      setRound(round + 1);
      if (round === 5) alert('Good game!');
    }
  }
}
```

---

## Rule 5 — Never use useEffect to notify a parent about state changes

Call the parent's callback from the same event handler that updates local state. Effects that call `onChange` fire after the render, causing a second render pass.

```tsx
// ❌ Avoid — notifying parent via effect
useEffect(() => {
  onChange(isOn);
}, [isOn, onChange]);

// ✅ Update both in the event handler
function updateToggle(nextIsOn) {
  setIsOn(nextIsOn);
  onChange(nextIsOn);
}
```

When possible, lift state up and make the component fully controlled by the parent instead.

---

## Rule 6 — Never use useEffect to pass data up to a parent

Data flows down in React. If a child fetches data that a parent also needs, move the fetch to the parent and pass it down as a prop.

```tsx
// ❌ Avoid — child pushing data up via effect
function Child({ onFetched }) {
  const data = useSomeAPI();
  useEffect(() => {
    if (data) onFetched(data);
  }, [onFetched, data]);
}

// ✅ Fetch in the parent, pass down
function Parent() {
  const data = useSomeAPI();
  return <Child data={data} />;
}
```

---

## Rule 7 — Use useSyncExternalStore for external store subscriptions

Do not manually subscribe to external stores with `useEffect` + `useState`. Use the purpose-built `useSyncExternalStore` hook.

```tsx
// ❌ Avoid — manual subscription via effect
useEffect(() => {
  function update() {
    setIsOnline(navigator.onLine);
  }
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}, []);

// ✅ Use useSyncExternalStore
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine, // client snapshot
    () => true, // server snapshot
  );
}
```

---

## Rule 8 — Always add cleanup when fetching data in effects

Raw data fetching in effects must include a cleanup function to ignore stale responses (race conditions). Prefer **TanStack Query** which handles this automatically.

```tsx
// ❌ Avoid — no cleanup, race condition risk
useEffect(() => {
  fetchResults(query, page).then((json) => setResults(json));
}, [query, page]);

// ✅ With cleanup
useEffect(() => {
  let ignore = false;
  fetchResults(query, page).then((json) => {
    if (!ignore) setResults(json);
  });
  return () => {
    ignore = true;
  };
}, [query, page]);

// ✅ Best — use TanStack Query
const { data: results } = useQuery({
  queryKey: ['search', query, page],
  queryFn: () => fetchResults(query, page),
});
```

---

## Rule 9 — One-time app initialization belongs outside components

Logic that must run exactly once per app load (not per component mount) should live outside the component tree, not in a `useEffect([])`.

```tsx
// ❌ Avoid — runs twice in React 19 Strict Mode
useEffect(() => {
  loadDataFromLocalStorage();
  checkAuthToken();
}, []);

// ✅ Run at module level (outside any component)
if (typeof window !== 'undefined') {
  checkAuthToken();
  loadDataFromLocalStorage();
}

function App() { ... }
```

---

## Quick Reference

| Situation                           | Solution                                                     |
| ----------------------------------- | ------------------------------------------------------------ |
| Derive value from props/state       | Calculate during render                                      |
| Expensive calculation               | `useMemo`                                                    |
| Reset all state when prop changes   | Pass `key` to the component                                  |
| Adjust part of state on prop change | Set state during render (prevProp pattern) or derive from ID |
| Shared logic between event handlers | Extract a named function                                     |
| Notify parent of state change       | Call parent callback from event handler                      |
| Subscribe to external store         | `useSyncExternalStore`                                       |
| Data fetching                       | TanStack Query; if raw effect, always add cleanup            |
| One-time app initialization         | Module-level code outside components                         |
