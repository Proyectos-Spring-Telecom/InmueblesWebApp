import { Injectable, signal } from '@angular/core';
import { Todos } from 'src/app/pages/apps/kanban/kanban';
import {
  todos,
  inprogress,
  completed,
  onhold,
} from 'src/app/pages/apps/kanban/kanbanData';

@Injectable({
  providedIn: 'root',
})
export class KanbanService {
  todos = signal<Todos[] | any>(todos);
  inProgress = signal<Todos[] | any>(inprogress);
  completed = signal<Todos[] | any>(completed);
  onHold = signal<Todos[] | any>(onhold);

  constructor() {}

  getAllTasks(): {
    todos: Todos[];
    inProgress: Todos[];
    completed: Todos[];
    onHold: Todos[];
  } {
    return {
      todos: this.todos(),
      inProgress: this.inProgress(),
      completed: this.completed(),
      onHold: this.onHold(),
    };
  }

  addTask(task: Todos): void {
    const currentTodos = this.todos();
    const newTask = {
      ...task,
      id: currentTodos.length
        ? currentTodos[currentTodos.length - 1].id + 1
        : 1, // Generate a new ID
    };
    this.todos.set([...currentTodos, newTask]);
  }

  editTask(updatedTask: Todos): void {
    const currentTodos = this.todos();
    const updatedTodos = currentTodos.map((task: { id: number }) =>
      task.id === updatedTask.id ? updatedTask : task
    );
    this.todos.set(updatedTodos);

    this.updateTaskInList(this.inProgress(), updatedTask);
    this.updateTaskInList(this.completed(), updatedTask);
    this.updateTaskInList(this.onHold(), updatedTask);
  }

  private updateTaskInList(taskList: Todos[], updatedTask: Todos): void {
    const updatedList = taskList.map((task) =>
      task.id === updatedTask.id ? updatedTask : task
    );
    if (taskList === this.inProgress()) {
      this.inProgress.set(updatedList);
    } else if (taskList === this.completed()) {
      this.completed.set(updatedList);
    } else if (taskList === this.onHold()) {
      this.onHold.set(updatedList);
    }
  }
  deleteTask(taskId: number): void {
    this.todos.set(
      this.todos().filter((task: { id: number }) => task.id !== taskId)
    );
    this.inProgress.set(
      this.inProgress().filter((task: { id: number }) => task.id !== taskId)
    );
    this.completed.set(
      this.completed().filter((task: { id: number }) => task.id !== taskId)
    );
    this.onHold.set(
      this.onHold().filter((task: { id: number }) => task.id !== taskId)
    );
  }
}
