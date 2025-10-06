import React from "react";
import "./UserTable.css";

const SkeletonRows = ({ rows = 6, cols = 5 }) => {
    return (
        <tbody className="skeleton-body">
            {Array.from({ length: rows }).map((_,i)=>(
                <tr key={i}>
                    {Array.from({ length: cols }).map((__,j)=>(
                        <td key={j}><div className="sk-line" style={{width:["40%","55%","70%","50%","60%"][(j)%5]}}></div></td>
                    ))}
                </tr>
            ))}
        </tbody>
    );
};

const UserTable = ({ users, onBan, onDelete, userType, loading }) => {
        return (
                <div className="user-table">
                        {loading ? (
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th><th>Name</th><th>Email</th><th>Status</th><th>Actions</th>
                                    </tr>
                                </thead>
                                <SkeletonRows />
                            </table>
                        ) : users.length === 0 ? (
                                <p>No {userType}s found.</p>
                        ) : (
                                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user._id} className={user.status === 'banned' ? 'banned' : ''}>
                                <td>{user._id}</td>
                                <td>{user.fullName || user.username}</td>
                                <td>{user.email}</td>
                                <td>
                                    <span className={`status-badge ${user.status}`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td>
                                    <button 
                                        className="delete-btn" 
                                        onClick={() => onDelete(user._id, userType)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default UserTable;