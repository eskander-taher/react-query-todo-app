import axios from "axios";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import "./App.css";

const BASE_URL = "write your api base url here";
const axiosInstance = axios.create({ baseURL: BASE_URL });

interface Todo {
  id?: string;
  content: string;
  checked: boolean;
}

function App() {
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const getTodos = useQuery({
    queryKey: ["todos"],
    queryFn: () => axiosInstance.get<Todo[]>("todos").then((res) => res.data),
  });

  const addTodo = useMutation({
    mutationFn: (data: Todo) =>
      axiosInstance.post<Todo>("todos", data).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["todos"], (prev: Todo[]) => {
        return [...prev, data];
      });
    },
  });

  const updateTodo = useMutation({
    mutationFn: (data: Todo) =>
      axiosInstance.put<Todo>(`todos/${data.id}`, data).then((res) => res.data),
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["todos"] });

      // Snapshot the previous value
      const previousTodos = queryClient.getQueryData(["todos"]);

      // Optimistically update to the new value
      queryClient.setQueryData(["todos"], (prev: Todo[]) => {
        return prev.map((todo) => (todo.id === data.id ? data : todo));
      });

      // Return a context object with the snapshotted value
      return { previousTodos };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["todos"], context?.previousTodos);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const deleteTodo = useMutation({
    mutationFn: (data: Todo) =>
      axiosInstance.delete<Todo>(`todos/${data.id}`).then((res) => res.data),
    onMutate: async (data) => {
      queryClient.cancelQueries({ queryKey: ["todos"] });
      const previousTodos = await queryClient.getQueryData(["todos"]);
      queryClient.setQueryData(["todos"], (prev: Todo[]): Todo[] => {
        return prev.filter((todo) => todo.id !== data.id);
      });
      return { previousTodos };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["todos"], context?.previousTodos);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  if (getTodos.isLoading) return <h1>Loading...</h1>;
  if (getTodos.isError) return <h1>{getTodos.error.message}</h1>;

  return (
    <div>
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        disabled={addTodo.isPending}
        onClick={() => {
          if (content.trim()) {
            addTodo.mutate({
              content,
              checked: false,
            });
            setContent("");
          }
        }}
      >
        {addTodo.isPending ? "Adding" : "Add"}
      </button>
      {getTodos.data?.map((todo) => {
        return (
          <div key={todo.id}>
            <p>{todo.content}</p>
            <button
              disabled={
                updateTodo.isPending && updateTodo.variables.id == todo.id
              }
              onClick={() =>
                updateTodo.mutate({ ...todo, checked: !todo.checked })
              }
            >
              {todo.checked ? "undo" : "do"}
            </button>
            <button
              disabled={
                deleteTodo.isPending && deleteTodo.variables.id == todo.id
              }
              onClick={() => deleteTodo.mutate(todo)}
            >
              delete
            </button>
          </div>
        );
      })}
      {addTodo.isPending && (
        <div className="loading-animation">
          <p>{addTodo.variables.content}</p>
        </div>
      )}
      {addTodo.isError && (
        <div style={{ color: "red" }}>
          <p>{addTodo.variables.content}</p>
          <button onClick={() => addTodo.mutate(addTodo.variables)}>
            retry
          </button>
          <button onClick={() => addTodo.reset()}>cancel</button>
        </div>
      )}
    </div>
  );
}

export default App;
