# Messages
- server `A[[length]]:[[protocols,]]` -- send what protocols are accepted
- client `P[[length]]:[[protocol]]` -- send what protocol to use
- server `B` -- begin the transfer
- server `E[[length]]:[[error]]` -- send an error

# Errors
- server `NS[[protocol]]` -- `protocol` isn't supported